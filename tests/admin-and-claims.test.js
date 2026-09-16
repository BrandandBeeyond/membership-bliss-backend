const test = require("node:test");
const assert = require("node:assert/strict");
const { generateClaimCode, hashCode, verifyClaimCode, makeClaimMembership, makeGenerateOfflineClaimCode } = require("../services/offline-claim");
const { makeAdminManagement } = require("../controllers/admin-management.controller");

const code = "A1B2C3D4E5F6";
const bookingId = "1234567890abcdef12345678";
const ownerId = "111111111111111111111111";
const userId = "222222222222222222222222";
const chain = (value) => ({ select: async () => value, populate: async () => value, then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) });
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

function claimFixture(options = {}) {
  const updates = [];
  const booking = { _id: bookingId, userId, memberDetails: { phone: "9876543210" }, claimCodeHash: hashCode(code) };
  let claimed = false;
  const dependencies = {
    User: { findById: async () => ({ _id: userId, phone: "9876543210" }) },
    MembershipBooking: {
      findOne: (filter) => {
        if (filter.membershipNumber) {
          assert.equal(filter.claimStatus, "Pending");
          assert.equal(filter.status, "Active");
          assert.equal(filter.paymentStatus, "Completed");
          assert.ok(filter.endDate.$gte instanceof Date);
          return chain(options.missing ? null : { ...booking, ...options.booking });
        }
        return chain(options.otherMembership || null);
      },
      findOneAndUpdate: (filter, update) => {
        updates.push({ filter, update });
        const result = claimed ? null : { _id: bookingId, claimStatus: "Claimed" };
        claimed = true;
        return chain(result);
      },
    },
  };
  return { handler: makeClaimMembership(dependencies), updates, req: { user: { _id: userId }, body: { membershipNumber: "TWB-ABC12345", claimCode: code } } };
}

test("claim codes are random, correctly shaped and verified without plaintext storage", () => {
  const codes = new Set(Array.from({ length: 100 }, generateClaimCode));
  assert.equal(codes.size, 100);
  for (const value of codes) assert.match(value, /^[A-F0-9]{12}$/);
  assert.equal(verifyClaimCode("a1b2-c3d4-e5f6", hashCode(code)), true);
  assert.equal(verifyClaimCode("A1B2C3D4E5F7", hashCode(code)), false);
  assert.equal(verifyClaimCode(code, undefined), false);
  assert.equal(verifyClaimCode("", hashCode(code)), false);
});

test("number without claim code cannot claim membership", async () => {
  const fixture = claimFixture();
  delete fixture.req.body.claimCode;
  const res = response();
  await fixture.handler(fixture.req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(fixture.updates.length, 0);
});

test("wrong code, legacy missing code and unknown membership fail closed", async () => {
  for (const options of [{ booking: { claimCodeHash: hashCode("000000000000") } }, { booking: { claimCodeHash: undefined } }, { missing: true }]) {
    const fixture = claimFixture(options), res = response();
    await fixture.handler(fixture.req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.booking, undefined);
    assert.equal(fixture.updates.length, 0);
  }
});

test("different owner prevents claims even with correct code", async () => {
  const fixture = claimFixture({ booking: { userId: ownerId, memberDetails: { phone: "9999999999" } } }), res = response();
  await fixture.handler(fixture.req, res);
  assert.equal(res.statusCode, 403);
  assert.equal(fixture.updates.length, 0);
});

test("correct number and code claim without OTP and cannot be replayed", async () => {
  const fixture = claimFixture(), first = response(), second = response();
  await fixture.handler(fixture.req, first);
  await fixture.handler(fixture.req, second);
  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 409);
  assert.equal(fixture.updates[0].filter.claimCodeHash, hashCode(code));
  assert.equal(fixture.updates[0].filter.claimStatus, "Pending");
  assert.equal(fixture.updates[0].update.$unset.claimCodeHash, 1);
  assert.equal(fixture.req.body.otp, undefined);
  assert.equal(fixture.updates[0].update.$set.userId, userId);
  assert.equal(first.body.booking.claimCodeHash, undefined);
});

test("another active membership blocks a claim", async () => {
  const fixture = claimFixture({ otherMembership: { _id: "other" } }), res = response();
  await fixture.handler(fixture.req, res);
  assert.equal(res.statusCode, 409);
  assert.equal(fixture.updates.length, 0);
});

test("staff can issue codes only for unclaimed active offline bookings", async () => {
  let saved;
  const handler = makeGenerateOfflineClaimCode({ MembershipBooking: { findOneAndUpdate: async (filter, update) => {
    assert.equal(filter.claimStatus, "Pending");
    assert.equal(filter.paymentMethod, "cash");
    saved = update.$set;
    return { membershipNumber: "TWB-ABC12345" };
  } } });
  const res = response();
  await handler({ params: { id: bookingId } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(verifyClaimCode(res.body.claimCode, saved.claimCodeHash), true);
  assert.equal(saved.claimCode, undefined);
});

test("admin update uses save for password hashing and does not accept role escalation", async () => {
  let saved = false;
  const admin = { _id: bookingId, role: "ADMIN", name: "Old", password: "existing", save: async () => { saved = true; } };
  const handlers = makeAdminManagement({ findOne: async (filter) => { assert.equal(filter.role.$ne, "SUPER_ADMIN"); return admin; } });
  const res = response();
  await handlers.updateAdmin({ params: { id: bookingId }, admin: { _id: ownerId }, body: { name: " Updated ", email: "NEW@EXAMPLE.COM", password: "new-password", isActive: false, role: "SUPER_ADMIN" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(saved, true);
  assert.equal(admin.role, "ADMIN");
  assert.equal(admin.email, "new@example.com");
  assert.equal(admin.password, "new-password");
  assert.equal(admin.isActive, false);
  assert.equal(res.body.admin.password, undefined);
});

test("blank password preserves existing password", async () => {
  const admin = { _id: bookingId, password: "existing-hash", save: async () => {} };
  const handlers = makeAdminManagement({ findOne: async () => admin });
  const res = response();
  await handlers.updateAdmin({ params: { id: bookingId }, admin: { _id: ownerId }, body: { name: "Name", email: "test@example.com", password: "" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(admin.password, "existing-hash");
});

test("delete protects own/super-admin accounts and missing users", async () => {
  let deletes = 0;
  const handlers = makeAdminManagement({ findOneAndDelete: async (filter) => { deletes++; assert.equal(filter.role.$ne, "SUPER_ADMIN"); return null; } });
  const own = response();
  await handlers.deleteAdmin({ params: { id: ownerId }, admin: { _id: ownerId } }, own);
  assert.equal(own.statusCode, 403);
  assert.equal(deletes, 0);
  const other = response();
  await handlers.deleteAdmin({ params: { id: bookingId }, admin: { _id: ownerId } }, other);
  assert.equal(other.statusCode, 404);
});

test("duplicate admin email reports conflict", async () => {
  const handlers = makeAdminManagement({ findOne: async () => ({ save: async () => { throw { code: 11000 }; } }) });
  const res = response();
  await handlers.updateAdmin({ params: { id: bookingId }, admin: { _id: ownerId }, body: { name: "Name", email: "test@example.com" } }, res);
  assert.equal(res.statusCode, 409);
});
