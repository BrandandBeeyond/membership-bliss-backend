const Qrcode = require("qrcode");
const { v4: uuidv4 } = require("uuid");
const { APP_BASE_URL } = require("../utils/config");

async function buildBookingQr() {
  const token = uuidv4();
  const dataUrl = await Qrcode.toDataURL(`${APP_BASE_URL}/bookings/qr/verify/${token}`);
  return { token, dataUrl };
}

module.exports = { buildBookingQr };
