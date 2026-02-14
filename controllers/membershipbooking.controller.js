const MembershipBooking = require("../models/MembershipBooking.model");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const { APP_BASE_URL } = require("../utils/config");
const Qrcode = require("qrcode");
const createNotification = require("../config/createNotification");
const OfferCategory = require("../models/Offercategory.model");
const admin = require("firebase-admin");

const User = require("../models/User.model");

if (!admin.apps.length) {
  const ServiceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  admin.initializeApp({
    credential: admin.credential.cert(ServiceAccount),
  });
}

const VerifyPaymentandCreateBooking = async (req, res) => {
  try {
    const {
      membershipPlanId,
      razorpay_orderId,
      razorpay_paymentId,
      razorpay_signature,
      memberDetails,
    } = req.body;

    const userId = req.user._id;

    if (
      !membershipPlanId ||
      !razorpay_orderId ||
      !razorpay_paymentId ||
      !razorpay_signature ||
      !memberDetails
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing payment or membership details",
      });
    }

    const body = razorpay_orderId + "|" + razorpay_paymentId;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_orderId + "|" + razorpay_paymentId)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid Payment Signature" });
    }

    const existingActive = await MembershipBooking.findOne({
      userId,
      status: "Active",
    });

    if (existingActive) {
      return res.status(409).json({
        success: false,
        message: "User already has an active membership",
        booking: existingActive,
      });
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);

    const qrTrackingToken = uuidv4();

    const qrVerificationURL = `${APP_BASE_URL}/bookings/qr/verify/${qrTrackingToken}`;

    const qrCodeUrl = await Qrcode.toDataURL(qrVerificationURL);

    const newbooking = await MembershipBooking.create({
      userId,
      membershipPlanId,
      memberDetails,
      startDate,
      endDate,
      razorpay_orderId,
      razorpay_paymentId,
      razorpay_signature,
      paymentStatus: "Completed",
      status: "Active",

      arrivalDate: null,
      arrivalStatus: "NotRequested",
      physicalCardRequested: false,
      physicalCardIssued: false,
      qrTrackingToken,
      qrcodeURL: qrCodeUrl,
    });

    await createNotification({
      userId: userId,
      title: "Membership Activated",
      message: `Your membership is active till ${endDate.toDateString()}`,
      type: "booking",
    });

    const user = await User.findById(userId);
    const firstName = user?.fullname?.trim().split(/\s+/)[0] || "Member";

    if (user?.fcmToken) {
      await admin.messaging().send({
        token: user.fcmToken,
        notification: {
          title: `Congratulations ${firstName}`,
          body: `Membership Activated. Your membership is active till ${endDate.toDateString()}`,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Membership booking created successfully",
      booking: newbooking,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server error", error: error.message });
    console.error("Membership booking creation failed", error);
  }
};

const getbookedMembershipDetail = async (req, res) => {
  try {
    const userId = req.user._id;

    const booking = await MembershipBooking.findOne({
      userId,
      status: "Active",
      paymentStatus: "Completed",
      endDate: { $gte: new Date() },
    })
      .populate("membershipPlanId")
      .sort({ createdAt: -1 });

    if (!booking) {
      return res.status(200).json({
        success: true,
        hasMembership: false,
        booking: null,
      });
    }
    return res.status(200).json({
      success: true,
      hasMembership: true,
      booking: booking,
    });
  } catch (error) {
    console.error("Error fetching membership details:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch membership details",
    });
  }
};

const getUserBookings = async (req, res) => {
  try {
    const userId = req.user._id;

    const bookings = await MembershipBooking.find({ userId })
      .populate({
        path: "membershipPlanId",
        populate: {
          path: "categoryId",
          select: "name",
        },
      })
      .sort({ createdAt: -1 });

    if (!bookings || bookings.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No bookings found",
        bookings: [],
      });
    }

    return res.status(200).json({
      success: true,
      totalBookings: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Error fetching user bookings:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user bookings",
    });
  }
};

const getAllBookings = async (req, res) => {
  try {
    const allbookings = await MembershipBooking.find()
      .populate({ path: "userId", select: "name email" })
      .populate({ path: "membershipPlanId", select: "name description price" })
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      total: allbookings.length,
      bookings: allbookings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch all bookings",
    });
  }
};

const requestUserArrival = async (req, res) => {
  try {
    const { bookingId, arrivalDate } = req.body;
    const userId = req.user?._id;

    if (!bookingId || !arrivalDate) {
      return res.status(400).json({
        success: false,
        message: "booking Id and arrival date required",
      });
    }

    const parsedDate = new Date(arrivalDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid arrival date",
      });
    }

    const existing = await MembershipBooking.findOne({
      _id: bookingId,
      userId,
      status: "Active",
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Membership booking not found",
      });
    }

    if (existing.arrivalStatus === "Approved") {
      return res.status(409).json({
        success: false,
        message: "User arrival date is already approved",
      });
    }

    const booking = await MembershipBooking.findOneAndUpdate(
      { _id: bookingId, userId, status: "Active" },
      { $set: { arrivalDate: parsedDate, arrivalStatus: "Pending" } },
      { returnDocument: "after" },
    );

    return res.status(200).json({
      success: true,
      message: "Arrival request submitted successfully",
      booking,
    });
  } catch (error) {
    console.error("Arrival request failed:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const updateArrivalStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { arrivalStatus, arrivalDate } = req.body;

    if (!["Approved", "Rejected"].includes(arrivalStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid arrival status",
      });
    }

    const booking = await MembershipBooking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Membership booking not found",
      });
    }

    if (booking.arrivalStatus !== "Pending") {
      return res.status(400).json({
        success: false,
        message: "Arrival request already processed",
      });
    }

    const update = { arrivalStatus };

    if (arrivalStatus === "Approved") {
      const parsed = arrivalDate ? new Date(arrivalDate) : new Date();
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid arrival date",
        });
      }
      update.arrivalDate = parsed;
    }

    const updatedBooking = await MembershipBooking.findByIdAndUpdate(
      id,
      { $set: update },
      { returnDocument: "after" },
    );

    const user = await User.findById(updatedBooking.userId).select(
      "fullname fcmToken",
    );
    const firstName = user?.fullname?.trim().split(/\s+/)[0] || "Member";

    if (!user?.fcmToken) {
      console.log("No FCM token for user:", updatedBooking.userId.toString());
    } else {
      try {
        const isApproved = arrivalStatus === "Approved";

        const message = {
          token: user.fcmToken,
          notification: {
            title: isApproved
              ? `Arrival Approved, ${firstName}`
              : `Arrival Rejected, ${firstName}`,
            body: isApproved
              ? `Your arrival request is approved for ${updatedBooking.arrivalDate.toDateString()}`
              : "Your arrival request was rejected. Please contact support.",
          },
          data: {
            type: "ARRIVAL_STATUS",
            bookingId: String(updatedBooking._id),
            status: arrivalStatus,
          },
          android: {
            priority: "high",
          },
          apns: {
            headers: { "apns-priority": "10" },
          },
        };

        const messageId = await admin.messaging().send(message);
        console.log(
          "FCM sent:",
          messageId,
          "to user:",
          updatedBooking.userId.toString(),
        );
      } catch (err) {
        console.error("FCM send error:", err?.code, err?.message);

        if (
          err?.code === "messaging/registration-token-not-registered" ||
          err?.code === "messaging/invalid-registration-token"
        ) {
          await User.findByIdAndUpdate(updatedBooking.userId, {
            $unset: { fcmToken: 1 },
          });
          console.log(
            "Removed invalid FCM token for user:",
            updatedBooking.userId.toString(),
          );
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: `Arrival ${arrivalStatus.toLowerCase()} successfully`,
      booking: updatedBooking,
    });
  } catch (error) {
    console.error("Arrival Approval Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const getActiveMembership = async (req, res) => {
  try {
    const userId = req.user._id;

    const booking = await MembershipBooking.findOne({
      userId,
      status: "Active",
    }).lean();

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "No active membership found",
      });
    }

    const usedOffersWithDetails = await Promise.all(
      booking.usedOffers.map(async (used) => {
        const category = await OfferCategory.findOne(
          { _id: used.categoryId, "items._id": used.itemId },
          { title: 1, type: 1, "items.$": 1 },
        ).lean();

        if (!category) return null;

        return {
          categoryId: used.categoryId,
          itemId: used.itemId,
          categoryTitle: category.title,
          categoryType: category.type,
          item: category.items[0],
          quantityUsed: used.quantityUsed,
          usedOn: used.usedOn,
        };
      }),
    );

    booking.usedOffers = usedOffersWithDetails.filter(Boolean);

    return res.status(200).json({
      success: true,
      activeMembership: booking,
    });
  } catch (error) {
    console.error("getActiveMembership error", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

module.exports = {
  VerifyPaymentandCreateBooking,
  getbookedMembershipDetail,
  getUserBookings,
  getAllBookings,
  requestUserArrival,
  updateArrivalStatus,
  getActiveMembership,
};
