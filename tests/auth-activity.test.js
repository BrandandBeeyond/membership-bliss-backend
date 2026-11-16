const test = require("node:test");
const assert = require("node:assert/strict");
const { makeOtpRateLimit, makeRecordAuthEvent, minutesText, OTP_WINDOW_MS } = require("../services/auth-activity");

// In-memory stand-in for the AuthEvent model (create / find / updateOne).
function fakeAuthEvent(clock) {
  const rows = [];
  let seq = 0;
  const query = (list) => ({
    sort() { return this; },
    select() { return this; },
    lean: async () => list.map((r) => ({ _id: r._id, createdAt: r.createdAt })),
  });
  return {
    rows,
    create: async (doc) => {
      const row = { ...doc, _id: String(++seq).padStart(24, "0"), createdAt: new Date(clock.now) };
      rows.push(row);
      return row;
    },
    find: (filter) => query(rows
      .filter((r) => r.phone === filter.phone && r.type === filter.type && r.createdAt > filter.createdAt.$gt)
      .sort((a, b) => a.createdAt - b.createdAt || a._id.localeCompare(b._id))),
    updateOne: async ({ _id }, { $set }) => { Object.assign(rows.find((r) => r._id === _id), $set); },
  };
}

const req = { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1", "user-agent": "okhttp" } };

test("allows 3 OTPs, blocks the 4th, and unlocks 90 minutes after the first", async () => {
  const clock = { now: Date.parse("2026-11-16T10:00:00Z") };
  const AuthEvent = fakeAuthEvent(clock);
  const { reserveOtp } = makeOtpRateLimit(AuthEvent);

  for (const remaining of [2, 1, 0]) {
    const r = await reserveOtp(req, "9876543210", clock.now);
    assert.equal(r.allowed, true);
    assert.equal(r.remaining, remaining);
    clock.now += 10 * 60 * 1000; // 10 min apart: 10:00, 10:10, 10:20
  }

  const blocked = await reserveOtp(req, "9876543210", clock.now); // 10:30
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.unlockAt.toISOString(), "2026-11-16T11:30:00.000Z");
  assert.equal(blocked.retryAfterSeconds, 60 * 60);
  assert.equal(AuthEvent.rows.at(-1).type, "otp_limited");
  assert.equal(AuthEvent.rows.at(-1).ip, "1.2.3.4");

  // Other numbers are not affected.
  assert.equal((await reserveOtp(req, "9123456789", clock.now)).allowed, true);

  // Just after the first OTP leaves the window, one slot frees up.
  clock.now = Date.parse("2026-11-16T10:00:00Z") + OTP_WINDOW_MS + 1000;
  assert.equal((await reserveOtp(req, "9876543210", clock.now)).allowed, true);
  assert.equal((await reserveOtp(req, "9876543210", clock.now)).allowed, false);
});

test("a failed SMS does not use up one of the 3 OTPs", async () => {
  const clock = { now: Date.parse("2026-11-16T10:00:00Z") };
  const AuthEvent = fakeAuthEvent(clock);
  const { reserveOtp, releaseOtp } = makeOtpRateLimit(AuthEvent);

  const first = await reserveOtp(req, "9876543210", clock.now);
  await releaseOtp(first.eventId, "provider down");
  assert.equal(AuthEvent.rows[0].type, "otp_send_failed");

  for (let i = 0; i < 3; i += 1) assert.equal((await reserveOtp(req, "9876543210", clock.now)).allowed, true);
  assert.equal((await reserveOtp(req, "9876543210", clock.now)).allowed, false);
});

test("recordAuthEvent never throws", async () => {
  const record = makeRecordAuthEvent({ create: async () => { throw new Error("db down"); } });
  const original = console.error;
  console.error = () => {};
  try {
    assert.equal(await record(req, { type: "login", phone: "9876543210" }), null);
  } finally {
    console.error = original;
  }
});

test("minutesText formats wait time", () => {
  assert.equal(minutesText(60 * 60), "1 hr");
  assert.equal(minutesText(75 * 60), "1 hr 15 min");
  assert.equal(minutesText(61), "2 min");
});
