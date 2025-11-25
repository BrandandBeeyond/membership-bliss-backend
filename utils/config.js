const PORT = process.env.PORT;
const MONGO_URI = process.env.MONGO_URI;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;
const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID;
const MSG91_SENDER_ID = process.env.MSG91_SENDER_ID;
const JWT_SECRET = process.env.JWT_SECRET;

module.exports = {
  PORT,
  MONGO_URI,
  GOOGLE_CLIENT_ID,
  MSG91_AUTH_KEY,
  MSG91_TEMPLATE_ID,
  MSG91_SENDER_ID,
  JWT_SECRET,
};
