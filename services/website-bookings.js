// Admin endpoint: membership bookings made on the website (touchwoodbliss.com),
// fetched server-to-server so the feed secret never reaches the browser.

const CACHE_MS = 60 * 1000;

function makeWebsiteBookings({ http, env = process.env, now = () => Date.now() }) {
  let cache = null; // { at, bookings }

  return async (req, res) => {
    const url = env.WEBSITE_MEMBERSHIP_FEED_URL;
    const secret = env.WEBSITE_MEMBERSHIP_FEED_SECRET;
    if (!url || !secret) {
      return res.status(200).json({ success: true, configured: false, bookings: [], message: "Website bookings feed is not configured" });
    }

    const refresh = req.query?.refresh === "1";
    if (!refresh && cache && now() - cache.at < CACHE_MS) {
      return res.status(200).json({ success: true, configured: true, bookings: cache.bookings, fetchedAt: new Date(cache.at).toISOString() });
    }

    try {
      const { data } = await http.get(url, {
        params: { limit: 2000 },
        headers: { Authorization: `Bearer ${secret}` },
        timeout: 10000,
      });
      const bookings = Array.isArray(data?.bookings) ? data.bookings : [];
      cache = { at: now(), bookings };
      return res.status(200).json({ success: true, configured: true, bookings, fetchedAt: new Date(cache.at).toISOString() });
    } catch (error) {
      const status = error?.response?.status;
      console.error("Website bookings feed failed:", status || error?.code || error?.message);
      const message = status === 401 ? "Website rejected the feed secret — check WEBSITE_MEMBERSHIP_FEED_SECRET"
        : status === 503 ? "Website feed is not configured on touchwoodbliss.com yet"
        : "Could not reach the website bookings feed";
      // Serve the last good copy if there is one, flagged as stale.
      if (cache) return res.status(200).json({ success: true, configured: true, stale: true, message, bookings: cache.bookings, fetchedAt: new Date(cache.at).toISOString() });
      return res.status(502).json({ success: false, configured: true, message });
    }
  };
}

module.exports = { makeWebsiteBookings };
