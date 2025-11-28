const mongoose = require('mongoose');

const membershipBookingSchema = new mongoose.Schema({});

const MembershipBooking = mongoose.model('MembershipBooking', membershipBookingSchema);

module.exports = MembershipBooking;