// Guest sign-in tracking + OTP rate limiting.
// Factories take their models so they can be unit tested with fakes.

const OTP_LIMIT = 3; // OTPs allowed per phone...
const OTP_WINDOW_MS = 90 * 60 * 1000; // ...in any rolling 90-minute window

const clientIp = (req) =>
  String(req?.headers?.["x-forwarded-for"] || "").split(",")[0].trim() || req?.ip || "";

// Logging must never break login, so failures are only reported to the console.
function makeRecordAuthEvent(AuthEvent) {
  return async function recordAuthEvent(req, { type, phone = null, userId = null, method = null, detail = "" }) {
    try {
      return await AuthEvent.create({
        type,
        phone,
        userId,
        method,
        detail: String(detail || "").slice(0, 300),
        ip: clientIp(req).slice(0, 64),
        userAgent: String(req?.headers?.["user-agent"] || "").slice(0, 300),
      });
    } catch (error) {
      console.error("[auth-activity] could not record event:", type, error.message);
      return null;
    }
  };
}

// Reserve-then-count, so parallel requests cannot slip past the limit:
// the "otp_sent" row is written first, then we count rows in the window.
// If this request pushed the count over the limit, the row is downgraded
// to "otp_limited" and the request is refused.
function makeOtpRateLimit(AuthEvent) {
  async function reserveOtp(req, phone, now = Date.now()) {
    const since = new Date(now - OTP_WINDOW_MS);
    const reservation = await AuthEvent.create({
      type: "otp_sent",
      phone,
      method: "otp",
      ip: clientIp(req).slice(0, 64),
      userAgent: String(req?.headers?.["user-agent"] || "").slice(0, 300),
    });
    const recent = await AuthEvent.find({ phone, type: "otp_sent", createdAt: { $gt: since } })
      .sort({ createdAt: 1, _id: 1 })
      .select("_id createdAt")
      .lean();
    const position = recent.findIndex((e) => String(e._id) === String(reservation._id));
    if (position !== -1 && position < OTP_LIMIT) {
      return { allowed: true, eventId: reservation._id, remaining: OTP_LIMIT - (position + 1) };
    }
    // Over the limit: unlock time is when the oldest counted OTP leaves the window.
    const unlockAt = new Date(new Date(recent[0]?.createdAt || now).getTime() + OTP_WINDOW_MS);
    await AuthEvent.updateOne(
      { _id: reservation._id },
      { $set: { type: "otp_limited", detail: `Limit of ${OTP_LIMIT} OTPs in 90 minutes reached. Unlocks at ${unlockAt.toISOString()}` } },
    );
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((unlockAt.getTime() - now) / 1000)), unlockAt };
  }

  // SMS failed: free the slot so the guest is not penalised for our provider's error.
  async function releaseOtp(eventId, detail) {
    await AuthEvent.updateOne({ _id: eventId }, { $set: { type: "otp_send_failed", detail: String(detail || "").slice(0, 300) } }).catch(() => {});
  }

  return { reserveOtp, releaseOtp };
}

const minutesText = (seconds) => {
  const minutes = Math.ceil(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} hr ${minutes % 60 ? `${minutes % 60} min` : ""}`.trim() : `${minutes} min`;
};

// ---------- Admin read endpoints ----------

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toInt = (value, fallback, min, max) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
};
// Users created before timestamps were added have no createdAt; the ObjectId holds the creation time.
const signupTime = (user) => user.createdAt || (user._id?.getTimestamp ? user._id.getTimestamp() : null);

function makeGuestsAdmin({ User, AuthEvent, MembershipBooking }) {
  async function listGuests(req, res) {
    try {
      const page = toInt(req.query.page, 1, 1, 10000);
      const limit = toInt(req.query.limit, 25, 1, 100);
      const search = String(req.query.search || "").trim().slice(0, 100);
      const filter = {};
      if (search) {
        const rx = new RegExp(escapeRegex(search), "i");
        filter.$or = [{ fullname: rx }, { email: rx }, { phone: new RegExp(escapeRegex(search.replace(/\D/g, "") || search)) }];
      }
      const sort = req.query.sort === "signup" ? { _id: -1 } : { lastLoginAt: -1, _id: -1 };

      const [total, users] = await Promise.all([
        User.countDocuments(filter),
        User.find(filter)
          .sort(sort)
          .skip((page - 1) * limit)
          .limit(limit)
          .select("fullname email phone city loginType profileCompleted createdAt lastLoginAt loginCount profileImage")
          .lean(),
      ]);

      const phones = users.map((u) => u.phone).filter(Boolean);
      const ids = users.map((u) => u._id);
      const since = new Date(Date.now() - OTP_WINDOW_MS);
      const [otpRows, memberships] = await Promise.all([
        phones.length
          ? AuthEvent.aggregate([
              { $match: { phone: { $in: phones }, type: "otp_sent", createdAt: { $gt: since } } },
              { $group: { _id: "$phone", count: { $sum: 1 }, oldest: { $min: "$createdAt" } } },
            ])
          : [],
        ids.length
          ? MembershipBooking.aggregate([
              { $match: { userId: { $in: ids } } },
              { $group: { _id: "$userId", count: { $sum: 1 } } },
            ])
          : [],
      ]);
      const otpByPhone = new Map(otpRows.map((r) => [r._id, r]));
      const membershipsByUser = new Map(memberships.map((r) => [String(r._id), r.count]));

      const guests = users.map((u) => {
        const otp = otpByPhone.get(u.phone);
        const used = otp?.count || 0;
        return {
          _id: u._id,
          fullname: u.fullname || "",
          email: u.email || "",
          phone: u.phone || "",
          city: u.city || "",
          profileImage: u.profileImage || null,
          loginType: u.loginType,
          profileCompleted: Boolean(u.profileCompleted),
          signedUpAt: signupTime(u),
          lastLoginAt: u.lastLoginAt || null,
          loginCount: u.loginCount || 0,
          memberships: membershipsByUser.get(String(u._id)) || 0,
          otp: {
            used,
            limit: OTP_LIMIT,
            lockedUntil: used >= OTP_LIMIT ? new Date(new Date(otp.oldest).getTime() + OTP_WINDOW_MS) : null,
          },
        };
      });

      return res.status(200).json({ success: true, guests, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
    } catch (error) {
      console.error("[guests] list failed:", error.message);
      return res.status(500).json({ success: false, message: "Unable to load guests" });
    }
  }

  async function listAuthActivity(req, res) {
    try {
      const page = toInt(req.query.page, 1, 1, 10000);
      const limit = toInt(req.query.limit, 50, 1, 200);
      const filter = {};
      const types = String(req.query.type || "").split(",").map((t) => t.trim()).filter(Boolean);
      if (types.length) filter.type = { $in: types };
      const phone = String(req.query.phone || "").replace(/\D/g, "").slice(-10);
      if (phone) filter.phone = phone;
      if (req.query.from || req.query.to) {
        filter.createdAt = {};
        if (req.query.from && !Number.isNaN(Date.parse(req.query.from))) filter.createdAt.$gte = new Date(req.query.from);
        if (req.query.to && !Number.isNaN(Date.parse(req.query.to))) filter.createdAt.$lte = new Date(req.query.to);
      }

      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [total, events, summaryRows] = await Promise.all([
        AuthEvent.countDocuments(filter),
        AuthEvent.find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate("userId", "fullname email phone")
          .lean(),
        AuthEvent.aggregate([
          { $match: { createdAt: { $gte: since24h } } },
          { $group: { _id: "$type", count: { $sum: 1 } } },
        ]),
      ]);

      const last24h = Object.fromEntries(summaryRows.map((r) => [r._id, r.count]));
      const activity = events.map((e) => ({
        _id: e._id,
        type: e.type,
        phone: e.phone,
        method: e.method,
        detail: e.detail,
        ip: e.ip,
        userAgent: e.userAgent,
        createdAt: e.createdAt,
        guest: e.userId ? { _id: e.userId._id, fullname: e.userId.fullname || "", email: e.userId.email || "", phone: e.userId.phone || "" } : null,
      }));

      return res.status(200).json({ success: true, activity, total, page, pages: Math.max(1, Math.ceil(total / limit)), last24h });
    } catch (error) {
      console.error("[guests] activity failed:", error.message);
      return res.status(500).json({ success: false, message: "Unable to load login activity" });
    }
  }

  return { listGuests, listAuthActivity };
}

module.exports = {
  OTP_LIMIT,
  OTP_WINDOW_MS,
  clientIp,
  minutesText,
  makeRecordAuthEvent,
  makeOtpRateLimit,
  makeGuestsAdmin,
};
