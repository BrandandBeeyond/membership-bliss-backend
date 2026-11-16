const test = require("node:test");
const assert = require("node:assert/strict");
const { makeWebsiteBookings } = require("../services/website-bookings");

const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
const env = { WEBSITE_MEMBERSHIP_FEED_URL: "https://site.test/api/membership/feed", WEBSITE_MEMBERSHIP_FEED_SECRET: "s".repeat(40) };

test("unconfigured feed returns an empty, flagged list without calling out", async () => {
  let called = false;
  const res = response();
  await makeWebsiteBookings({ http: { get: async () => { called = true; } }, env: {} })({ query: {} }, res);
  assert.equal(res.body.configured, false);
  assert.equal(called, false);
});

test("fetches with the bearer secret, caches for a minute, and refresh bypasses the cache", async () => {
  const calls = [];
  let t = 0;
  const handler = makeWebsiteBookings({ env, now: () => t, http: { get: async (url, opts) => { calls.push(opts); return { data: { bookings: [{ id: "order_1" }] } }; } } });
  let res = response();
  await handler({ query: {} }, res);
  assert.equal(calls[0].headers.Authorization, `Bearer ${env.WEBSITE_MEMBERSHIP_FEED_SECRET}`);
  assert.equal(res.body.bookings[0].id, "order_1");
  t = 30000; res = response(); await handler({ query: {} }, res);
  assert.equal(calls.length, 1);
  res = response(); await handler({ query: { refresh: "1" } }, res);
  assert.equal(calls.length, 2);
});

test("errors serve the last good copy as stale, or 502 with a helpful message", async () => {
  let fail = false;
  const handler = makeWebsiteBookings({ env, http: { get: async () => { if (fail) { const e = new Error("x"); e.response = { status: 401 }; throw e; } return { data: { bookings: [{ id: "a" }] } }; } } });
  await handler({ query: {} }, response());
  fail = true;
  const res = response();
  await handler({ query: { refresh: "1" } }, res);
  assert.equal(res.body.stale, true);
  assert.match(res.body.message, /secret/);
  const fresh = makeWebsiteBookings({ env, http: { get: async () => { throw Object.assign(new Error("down"), { code: "ECONNREFUSED" }); } } });
  const res2 = response();
  await fresh({ query: {} }, res2);
  assert.equal(res2.statusCode, 502);
});
