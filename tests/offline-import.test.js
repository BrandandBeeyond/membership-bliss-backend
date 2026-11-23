const test = require("node:test");
const assert = require("node:assert/strict");
const { makeImportOfflineBookings, parsePurchaseDate, normalizePhone } = require("../services/offline-import");
const { verifyClaimCode, normalizeMembershipNumber, membershipNumberCandidates } = require("../services/offline-claim");

const planId = "6933c5b6db7b67ba20513de9";
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

function fixture({ existingNumbers = [], users = [], activeFor = [] } = {}) {
  const created = [];
  const createdUsers = [];
  const deps = {
    now: () => new Date("2026-11-16T00:00:00Z"),
    buildQr: async () => ({ token: `qr-${created.length}`, dataUrl: "data:image/png;base64,x" }),
    MembershipPlan: { findById: async (id) => (id === planId ? { _id: planId, validityinDays: 365 } : null) },
    User: {
      findOne: async ({ phone }) => users.find((user) => user.phone === phone) || null,
      create: async (data) => { const user = { _id: `u${createdUsers.length}`, ...data }; createdUsers.push(user); return user; },
    },
    MembershipBooking: {
      findOne: async (filter) => {
        if (filter.membershipNumber) return existingNumbers.includes(filter.membershipNumber) ? { membershipNumber: filter.membershipNumber } : null;
        return activeFor.includes(filter.userId) ? { membershipNumber: "TWB-OLD" } : null;
      },
      create: async (data) => { created.push(data); return data; },
    },
  };
  return { handler: makeImportOfflineBookings(deps), created, createdUsers };
}

const row = (overrides = {}) => ({ fullname: "Rajesh Mutha", phone: "99232 82936", purchaseDate: "23-01-2026", membershipNumber: "BNC NSK 0095", leadSource: "Reference", salesPerson: "Alkesh Sir", branch: "NSK", amount: "8000", paymentMode: "Cash", remarks: "", ...overrides });

test("imports sheet rows with sales details, purchase-date validity and a claim code", async () => {
  const { handler, created, createdUsers } = fixture();
  const res = response();
  await handler({ body: { membershipPlanId: planId, rows: [row(), row({ fullname: "Mahesh", phone: "8275513684", membershipNumber: "BNC NSK 0117", amount: "0", paymentMode: "", remarks: "Complimentary Approved by Amit Sir" })] } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.summary, { total: 2, created: 2, skipped: 0, failed: 0 });
  const [paid, free] = created;
  assert.equal(paid.membershipNumber, "BNC NSK 0095");
  assert.equal(paid.memberDetails.phone, "9923282936");
  assert.equal(paid.startDate.toISOString(), "2026-01-23T00:00:00.000Z");
  assert.equal(paid.endDate.toISOString(), "2027-01-23T00:00:00.000Z");
  assert.equal(paid.paymentMethod, "cash");
  assert.equal(paid.paymentMode, "Cash");
  assert.equal(paid.sellingCost, 8000);
  assert.equal(paid.paymentReceived, 8000);
  assert.equal(paid.salesPerson, "Alkesh Sir");
  assert.equal(paid.claimStatus, "Pending");
  assert.equal(paid.status, "Active");
  assert.equal(paid.isComplimentary, false);
  assert.ok(paid.claimCodeHash && paid.claimCodeCiphertext);
  assert.equal(free.isComplimentary, true);
  assert.equal(free.sellingCost, 0);
  assert.equal(createdUsers.length, 2);
});

test("re-running skips existing numbers, and bad or duplicate rows fail without stopping the batch", async () => {
  const { handler, created } = fixture({ existingNumbers: ["BNC NSK 0095"] });
  const res = response();
  await handler({ body: { membershipPlanId: planId, rows: [
    row(),
    row({ membershipNumber: "BNC NSK 0096", phone: "123" }),
    row({ membershipNumber: "BNC NSK 0097", purchaseDate: "31-02-2026", phone: "7447439322" }),
    row({ membershipNumber: "BNC NSK 0098", phone: "8149575548" }),
    row({ membershipNumber: "bnc nsk 98", phone: "8788164577" }),
  ] } }, res);
  assert.deepEqual(res.body.results.map((r) => r.status), ["skipped", "failed", "failed", "created", "failed"]);
  assert.equal(created.length, 1);
});

test("existing user with an active membership is not given a second one", async () => {
  const { handler, created } = fixture({ users: [{ _id: "u-existing", phone: "9923282936" }], activeFor: ["u-existing"] });
  const res = response();
  await handler({ body: { membershipPlanId: planId, rows: [row()] } }, res);
  assert.equal(res.body.results[0].status, "failed");
  assert.match(res.body.results[0].message, /active membership/);
  assert.equal(created.length, 0);
});

test("rejects missing plan and empty rows", async () => {
  const { handler } = fixture();
  let res = response();
  await handler({ body: { membershipPlanId: planId, rows: [] } }, res);
  assert.equal(res.statusCode, 400);
  res = response();
  await handler({ body: { membershipPlanId: "aaaaaaaaaaaaaaaaaaaaaaaa", rows: [row()] } }, res);
  assert.equal(res.statusCode, 404);
});

test("parsers and membership number normalisation", () => {
  assert.equal(parsePurchaseDate("09-09-2026").toISOString(), "2026-09-09T00:00:00.000Z");
  assert.equal(parsePurchaseDate("2026-09-09").toISOString(), "2026-09-09T00:00:00.000Z");
  assert.equal(parsePurchaseDate("13-13-2026"), null);
  assert.equal(normalizePhone("+91 95950 95950"), "9595095950");
  assert.equal(normalizeMembershipNumber("bncnsk95"), "BNC NSK 0095");
  assert.equal(normalizeMembershipNumber(" BNC  NSK 0126 "), "BNC NSK 0126");
  assert.equal(normalizeMembershipNumber("abc12345"), "BNC-ABC12345");
  assert.equal(normalizeMembershipNumber("bnc-abcd1234"), "BNC-ABCD1234");
  assert.equal(normalizeMembershipNumber("twb-abc12345"), "TWB-ABC12345");
  assert.equal(normalizeMembershipNumber("twbabc12345"), "TWB-ABC12345");
  assert.deepEqual(membershipNumberCandidates("abc12345").sort(), ["BNC-ABC12345", "TWB-ABC12345"]);
  assert.deepEqual(membershipNumberCandidates("bncabcd1234").sort(), ["BNC ABCD 1234", "BNC-ABCD1234"]);
  assert.equal(verifyClaimCode("12345", "x"), false);
});
