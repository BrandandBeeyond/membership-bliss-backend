const MembershipBooking = require("../models/MembershipBooking.model");
const PhysicalcardRequest = require("../models/PhysicalcardRequest.model");

const RequestPhysicalCard = async (req, res) => {
  try {
    const userId = req.user._id;

    const { bookingId, fullname, email, phone, address, city, state } =
      req.body;

    if (
      !bookingId ||
      !fullname ||
      !email ||
      !phone ||
      !address ||
      !city ||
      !state
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const booking = await MembershipBooking.findOne({ _id: bookingId, userId });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Membership booking not found",
      });
    }

    const exisitingPending = await PhysicalcardRequest.findOne({
      bookingId,
      status: "Pending",
    });

    if (exisitingPending) {
      return res.status(409).json({
        success: false,
        message: "A pending physical card request already exists",
      });
    }

    const cardRequest = await PhysicalcardRequest.create({
      bookingId,
      userId,
      fullname,
      email,
      phone,
      address,
      city,
      state,
    });

    return res.status(201).json({
      success: true,
      message: "Physical card request submitted",
      data: cardRequest,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to submit physical card request",
      error: error.message,
    });
  }
};

module.exports = { RequestPhysicalCard };
