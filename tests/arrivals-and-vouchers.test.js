const test = require("node:test");
const assert = require("node:assert/strict");
const { buildArrivalReview, arrivalNotificationText } = require("../services/arrival-review");
const { makeApproveRedemption, makeRejectRedemption, makeListRedemptions, makeMemberVoucherBalance } = require("../services/voucher-review");

const now = new Date("2026-11-16T06:00:00Z");
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

test("arrival approval keeps or changes the date and clears old suggestions", () => {
  const kept = buildArrivalReview({ arrivalStatus: "Approved", adminId: "a1", now });
  assert.equal(kept.update.arrivalStatus, "Approved");
  assert.equal("arrivalDate" in kept.update, false);
  assert.deepEqual(kept.update.suggestedArrivalDates, []);
  const moved = buildArrivalReview({ arrivalStatus: "Approved", arrivalDate: "2026-12-05", now });
  assert.equal(moved.update.arrivalDate.toISOString(), "2026-12-05T00:00:00.000Z");
  assert.ok(buildArrivalReview({ arrivalStatus: "Approved", arrivalDate: "2026-02-30", now }).error);
  assert.ok(buildArrivalReview({ arrivalStatus: "Maybe", now }).error);
});

test("arrival rejection stores up to three sorted, de-duplicated future suggestions", () => {
  const review = buildArrivalReview({ arrivalStatus: "Rejected", suggestedDates: ["2026-12-10", "2026-11-20", "", "2026-12-10"], note: "  Fully booked  ", now });
  assert.deepEqual(review.update.suggestedArrivalDates.map((d) => d.toISOString().slice(0, 10)), ["2026-11-20", "2026-12-10"]);
  assert.equal(review.update.arrivalAdminNote, "Fully booked");
  assert.ok(buildArrivalReview({ arrivalStatus: "Rejected", suggestedDates: ["2026-11-01"], now }).error, "past date");
  assert.ok(buildArrivalReview({ arrivalStatus: "Rejected", suggestedDates: ["2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04"], now }).error, "too many");
  assert.ok(buildArrivalReview({ arrivalStatus: "Rejected", suggestedDates: "2026-12-01", now }).error, "not a list");
  assert.deepEqual(buildArrivalReview({ arrivalStatus: "Rejected", now }).update.suggestedArrivalDates, []);
});

test("arrival notification mentions suggested dates", () => {
  const text = arrivalNotificationText({ arrivalStatus: "Rejected", arrivalAdminNote: "", suggestedArrivalDates: [new Date("2026-11-20T00:00:00Z")] }, "Asha");
  assert.match(text.body, /20 Nov 2026/);
  assert.match(arrivalNotificationText({ arrivalStatus: "Approved", arrivalDate: new Date("2026-11-20T00:00:00Z") }, "Asha").body, /approved for 20 Nov 2026/);
});

const ids = { redemption: "aaaaaaaaaaaaaaaaaaaaaaaa", booking: "bbbbbbbbbbbbbbbbbbbbbbbb", category: "cccccccccccccccccccccccc", item: "dddddddddddddddddddddddd", user: "eeeeeeeeeeeeeeeeeeeeeeee" };

function voucherFixture({ redemption = {}, used = 0, inventory = 5, alreadyProcessed = false } = {}) {
  const calls = { pushes: [], notes: [], updates: [] };
  const record = { _id: ids.redemption, membershipBookingId: ids.booking, categoryId: ids.category, itemId: ids.item, quantityRequested: 3, otpCode: "123456", status: "Pending", ...redemption };
  const deps = {
    now: () => now,
    notify: async (n) => calls.notes.push(n),
    VoucherRedeemtion: {
      findById: async () => record,
      findOneAndUpdate: async (filter, update) => { calls.updates.push({ filter, update }); return alreadyProcessed ? null : { ...record, ...update.$set }; },
      exists: async () => true,
    },
    MembershipBooking: {
      findById: (id) => { const b = { _id: id, userId: ids.user, status: "Active", endDate: new Date("2027-01-01"), usedOffers: used ? [{ itemId: ids.item, quantityUsed: used }] : [] }; return Object.assign(Promise.resolve(b), { select: async () => b }); },
      updateOne: async (filter, update) => calls.pushes.push(update.$push.usedOffers),
    },
    OfferCategory: { findById: async () => ({ title: "Dining", items: [{ _id: ids.item, name: "Buffet", inventory }] }) },
  };
  return { deps, calls };
}

const redeemReq = (body) => ({ admin: { _id: "admin1" }, body: { redemptionId: ids.redemption, otpCode: "123456", quantityApproved: 2, ...body } });

test("redeeming with the right code records usage and notifies the member", async () => {
  const { deps, calls } = voucherFixture();
  const res = response();
  await makeApproveRedemption(deps)(redeemReq({ adminId: "spoofed" }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.updates[0].filter.status, "Pending");
  assert.equal(calls.updates[0].update.$set.approvedBy, "admin1");
  assert.equal(calls.pushes[0].quantityUsed, 2);
  assert.equal(calls.pushes[0].redemptionId, ids.redemption);
  assert.match(calls.notes[0].message, /2 × Buffet/);
  assert.equal(res.body.data.otpCode, undefined);
});

test("wrong code, over-request, over-allowance and processed requests are refused", async () => {
  const cases = [
    [voucherFixture(), redeemReq({ otpCode: "654321" }), 400, /Incorrect code/],
    [voucherFixture(), redeemReq({ otpCode: "12" }), 400, /6-digit/],
    [voucherFixture(), redeemReq({ quantityApproved: 4 }), 400, /requested only 3/],
    [voucherFixture(), redeemReq({ quantityApproved: 1.5 }), 400, /at least 1/],
    [voucherFixture({ used: 4 }), redeemReq({ quantityApproved: 2 }), 400, /Only 1 left/],
    [voucherFixture({ redemption: { status: "Approved" } }), redeemReq(), 409, /already approved/],
    [voucherFixture({ alreadyProcessed: true }), redeemReq(), 409, /just processed/],
  ];
  for (const [{ deps, calls }, req, status, message] of cases) {
    const res = response();
    await makeApproveRedemption(deps)(req, res);
    assert.equal(res.statusCode, status, String(message));
    assert.match(res.body.message, message);
    assert.equal(calls.pushes.length, 0);
  }
});

test("rejecting a pending request records the reason and notifies; repeat rejection conflicts", async () => {
  const { deps, calls } = voucherFixture();
  const res = response();
  await makeRejectRedemption(deps)({ admin: { _id: "admin1" }, params: { id: ids.redemption }, body: { reason: "Outlet closed" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(calls.updates[0].update.$set.rejectionReason, "Outlet closed");
  assert.match(calls.notes[0].message, /Outlet closed/);
  const again = voucherFixture({ alreadyProcessed: true });
  const res2 = response();
  await makeRejectRedemption(again.deps)({ params: { id: ids.redemption }, body: {} }, res2);
  assert.equal(res2.statusCode, 409);
});

test("admin list resolves voucher names by category and item, hides codes, and shows remaining quantity", async () => {
  const chain = (value) => ({ select() { return this; }, sort() { return this; }, populate() { return this; }, lean: async () => value });
  let selected;
  const list = makeListRedemptions({
    VoucherRedeemtion: { find: () => ({ ...chain([{ _id: ids.redemption, categoryId: ids.category, itemId: ids.item, membershipBookingId: { _id: ids.booking, usedOffers: [{ itemId: ids.item, quantityUsed: 2 }] } }]), select(value) { selected = value; return this; } }) },
    OfferCategory: { find: () => chain([{ _id: ids.category, title: "Dining", type: "value", items: [{ _id: ids.item, name: "Buffet", worth: 500, inventory: 5 }] }]) },
  });
  const res = response();
  await list({}, res);
  const [row] = res.body.reedemedVouchers;
  assert.equal(selected, "-otpCode");
  assert.equal(row.offerTitle, "Dining");
  assert.equal(row.itemName, "Buffet");
  assert.equal(row.remainingQuantity, 3);
  assert.equal(row.membershipBookingId.usedOffers, undefined);
});

test("member voucher balance splits used and pending per voucher for a guest name", async () => {
  const item2 = "ffffffffffffffffffffffff";
  let bookingFilter;
  const chain = (result) => { const q = { select: () => q, populate: () => q, sort: () => q, limit: () => q, lean: async () => result }; return q; };
  const handler = makeMemberVoucherBalance({
    MembershipBooking: { find: (filter) => { bookingFilter = filter; return chain([{ _id: ids.booking, membershipNumber: "BNC 1", memberDetails: { fullname: "Harsh Shah", phone: "97" }, membershipPlanId: { name: "Gold", offers: [ids.category] }, usedOffers: [{ categoryId: ids.category, itemId: ids.item, quantityUsed: 2, usedOn: now }], status: "Active" }]); } },
    OfferCategory: { find: () => chain([{ _id: ids.category, title: "Rooms", type: "value", items: [{ _id: ids.item, name: "Room night", worth: 7500, inventory: 3 }, { _id: item2, name: "Half off", worth: 10000, inventory: 1 }] }]) },
    VoucherRedeemtion: { find: () => chain([{ membershipBookingId: ids.booking, itemId: item2, quantityRequested: 1 }]) },
  });
  const res = response();
  await handler({ query: { name: "sh (" } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(bookingFilter["memberDetails.fullname"].$regex, "sh \\(", "regex input is escaped");
  const [room, half] = res.body.members[0].vouchers;
  assert.deepEqual([room.usedQuantity, room.remainingQuantity], [2, 1]);
  assert.deepEqual([half.usedQuantity, half.remainingQuantity, half.waitingQuantity], [0, 1, 1]);

  const short = response();
  await handler({ query: { name: "a" } }, short);
  assert.equal(short.statusCode, 400);
});
