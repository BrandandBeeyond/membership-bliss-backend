// Validation and messages for an admin approving or rejecting a member's arrival request.

const MAX_SUGGESTED_DATES = 3;

const startOfUtcDay = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

// Accepts "YYYY-MM-DD" (from <input type="date">) or a full ISO timestamp.
const parseDay = (value) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = match ? new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (match && date.getUTCDate() !== +match[3]) return null;
  return date;
};

const formatDay = (date) => date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

function buildArrivalReview({ arrivalStatus, arrivalDate, suggestedDates, note, adminId, now = new Date() }) {
  if (!["Approved", "Rejected"].includes(arrivalStatus)) return { error: "Invalid arrival status" };
  const adminNote = typeof note === "string" ? note.trim().slice(0, 300) : "";
  const today = startOfUtcDay(now);
  const reviewed = { arrivalStatus, arrivalAdminNote: adminNote, arrivalReviewedAt: now, arrivalReviewedBy: adminId || null };

  if (arrivalStatus === "Approved") {
    const update = { ...reviewed, suggestedArrivalDates: [] };
    if (arrivalDate !== undefined && arrivalDate !== null && arrivalDate !== "") {
      const parsed = parseDay(String(arrivalDate));
      if (!parsed) return { error: "Invalid arrival date" };
      update.arrivalDate = parsed;
    }
    return { update };
  }

  const list = suggestedDates === undefined || suggestedDates === null ? [] : suggestedDates;
  if (!Array.isArray(list)) return { error: "suggestedDates must be a list of dates" };
  const unique = new Map();
  for (const value of list) {
    if (value === "" || value === null) continue;
    const parsed = parseDay(String(value));
    if (!parsed) return { error: "Invalid suggested date" };
    if (parsed < today) return { error: "Suggested dates cannot be in the past" };
    unique.set(parsed.getTime(), parsed);
  }
  if (unique.size > MAX_SUGGESTED_DATES) return { error: `At most ${MAX_SUGGESTED_DATES} suggested dates are allowed` };
  const suggested = [...unique.values()].sort((a, b) => a - b);
  return { update: { ...reviewed, suggestedArrivalDates: suggested } };
}

function arrivalNotificationText(booking, firstName) {
  if (booking.arrivalStatus === "Approved") {
    return {
      title: `Arrival Approved, ${firstName}`,
      body: `Your arrival request is approved for ${formatDay(new Date(booking.arrivalDate))}.${booking.arrivalAdminNote ? " " + booking.arrivalAdminNote : ""}`,
    };
  }
  const dates = (booking.suggestedArrivalDates || []).map((date) => formatDay(new Date(date)));
  const suggestion = dates.length ? ` Available dates: ${dates.join(", ")}. Open the app to request one.` : " Please choose another date or contact support.";
  return {
    title: `Arrival date unavailable, ${firstName}`,
    body: `We couldn't confirm your requested date.${booking.arrivalAdminNote ? " " + booking.arrivalAdminNote : ""}${suggestion}`,
  };
}

module.exports = { buildArrivalReview, arrivalNotificationText, parseDay, MAX_SUGGESTED_DATES };
