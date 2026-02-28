const MembershipBooking = require("../models/MembershipBooking.model");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const { APP_BASE_URL } = require("../utils/config");
const Qrcode = require("qrcode");
const createNotification = require("../config/createNotification");
const OfferCategory = require("../models/Offercategory.model");
const admin = require("firebase-admin");

const User = require("../models/User.model");
const PhysicalcardRequest = require("../models/PhysicalcardRequest.model");
const MembershipPlan = require("../models/MembershipPlan.model");

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
      paymentMethod = "online",
      existingBookingId,
      razorpay_orderId,
      razorpay_paymentId,
      razorpay_signature,
      memberDetails,
    } = req.body;

    const userId = req.user._id;

    if (!membershipPlanId || !memberDetails) {
      return res.status(400).json({
        success: false,
        message: "Missing membership details",
      });
    }

    if (!["online", "cash"].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method",
      });
    }

    if (
      paymentMethod === "online" &&
      (!razorpay_orderId || !razorpay_paymentId || !razorpay_signature)
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing online payment details",
      });
    }

    if (paymentMethod === "online") {
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(razorpay_orderId + "|" + razorpay_paymentId)
        .digest("hex");

      if (expectedSignature !== razorpay_signature) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid Payment Signature" });
      }
    }

    const existingActive = await MembershipBooking.findOne({
      userId,
      status: "Active",
      paymentStatus: "Completed",
    });

    if (existingActive) {
      return res.status(409).json({
        success: false,
        message: "User already has an active membership",
        booking: existingActive,
      });
    }

    if (paymentMethod === "online" && existingBookingId) {
      const pendingCashBooking = await MembershipBooking.findOne({
        _id: existingBookingId,
        userId,
        status: "Active",
        paymentStatus: "Pending",
        paymentMethod: "cash",
      });

      if (!pendingCashBooking) {
        return res.status(404).json({
          success: false,
          message: "Pending cash booking not found",
        });
      }

      pendingCashBooking.paymentMethod = "online";
      pendingCashBooking.paymentStatus = "Completed";
      pendingCashBooking.paymentDate = new Date();
      pendingCashBooking.razorpay_orderId = razorpay_orderId;
      pendingCashBooking.razorpay_paymentId = razorpay_paymentId;
      pendingCashBooking.razorpay_signature = razorpay_signature;
      await pendingCashBooking.save();

      await createNotification({
        userId: userId,
        title: "Membership Activated",
        message: `Your membership is active till ${pendingCashBooking.endDate.toDateString()}`,
        type: "booking",
      });

      const user = await User.findById(userId);
      const firstName = user?.fullname?.trim().split(/\s+/)[0] || "Member";

      if (user?.fcmToken) {
        await admin.messaging().send({
          token: user.fcmToken,
          notification: {
            title: `Congratulations ${firstName}`,
            body: `Membership Activated. Your membership is active till ${pendingCashBooking.endDate.toDateString()}`,
          },
        });
      }

      return res.status(200).json({
        success: true,
        message: "Membership payment completed successfully",
        booking: pendingCashBooking,
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
      paymentMethod,
      razorpay_orderId: paymentMethod === "online" ? razorpay_orderId : null,
      razorpay_paymentId:
        paymentMethod === "online" ? razorpay_paymentId : null,
      razorpay_signature:
        paymentMethod === "online" ? razorpay_signature : null,
      paymentStatus: paymentMethod === "online" ? "Completed" : "Pending",
      status: "Active",

      arrivalDate: null,
      arrivalStatus: "NotRequested",
      physicalCardRequested: false,
      physicalCardIssued: false,
      qrTrackingToken,
      qrcodeURL: qrCodeUrl,
    });

    if (paymentMethod === "online") {
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
    } else {
      await createNotification({
        userId: userId,
        title: "Cash Payment Pending",
        message:
          "Your membership request is created. Please complete cash payment to activate benefits.",
        type: "booking",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        paymentMethod === "online"
          ? "Membership booking created successfully"
          : "Cash booking created. Payment verification is pending",
      booking: newbooking,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server error", error: error.message });
    console.error("Membership booking creation failed", error);
  }
};

const createOfflineBookingByAdmin = async (req, res) => {
  try {
    const {
      userId,
      membershipPlanId,
      membershipNumber,
      memberDetails = {},
      fullname,
      email,
      phone,
      arrivalDate = null,
      arrivalStatus = "Approved",
      paymentStatus = "Completed",
    } = req.body;

    if (!membershipPlanId) {
      return res.status(400).json({
        success: false,
        message: "membershipPlanId is required",
      });
    }

    let user = null;
    if (userId) {
      user = await User.findById(userId);
    } else {
      const normalizedPhone = String(
        phone || memberDetails.phone || "",
      ).replace(/\D/g, "");
      if (!normalizedPhone || normalizedPhone.length < 10) {
        return res.status(400).json({
          success: false,
          message: "Valid phone number is required",
        });
      }

      user = await User.findOne({ phone: normalizedPhone });
      if (!user) {
        const safeFullname =
          fullname ||
          memberDetails.fullname ||
          `Offline User ${normalizedPhone.slice(-4)}`;
        const safeEmail = (email || memberDetails.email || undefined)
          ?.trim()
          ?.toLowerCase();

        if (safeEmail) {
          const existingEmailUser = await User.findOne({ email: safeEmail });
          if (existingEmailUser) {
            return res.status(409).json({
              success: false,
              message: "User already exists with this email",
              user: existingEmailUser,
            });
          }
        }

        user = await User.create({
          fullname: safeFullname.trim(),
          email: safeEmail,
          phone: normalizedPhone,
          loginType: "otp",
          city: memberDetails.city || "Offline",
          state: memberDetails.state || "Offline",
          profileCompleted: true,
        });
      }
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const plan = await MembershipPlan.findById(membershipPlanId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Membership plan not found",
      });
    }

    const existingActive = await MembershipBooking.findOne({
      userId: user._id,
      status: "Active",
      paymentStatus: "Completed",
      endDate: { $gte: new Date() },
    });

    if (existingActive) {
      return res.status(409).json({
        success: false,
        message: "User already has an active membership",
        booking: existingActive,
      });
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    const validityDays = Number(plan.validityinDays) || 365;
    endDate.setDate(endDate.getDate() + validityDays);

    const qrTrackingToken = uuidv4();
    const qrVerificationURL = `${APP_BASE_URL}/bookings/qr/verify/${qrTrackingToken}`;
    const qrCodeUrl = await Qrcode.toDataURL(qrVerificationURL);

    const normalizedArrivalDate = arrivalDate ? new Date(arrivalDate) : null;
    if (arrivalDate && Number.isNaN(normalizedArrivalDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid arrival date",
      });
    }

    const allowedArrivalStatuses = [
      "Pending",
      "Approved",
      "Rejected",
      "NotRequested",
    ];
    const safeArrivalStatus = allowedArrivalStatuses.includes(arrivalStatus)
      ? arrivalStatus
      : "Approved";

    const allowedPaymentStatuses = ["Pending", "Completed", "Failed"];
    const safePaymentStatus = allowedPaymentStatuses.includes(paymentStatus)
      ? paymentStatus
      : "Completed";

    const bookingPayload = {
      userId: user._id,
      membershipPlanId,
      memberDetails: {
        fullname: memberDetails.fullname || user.fullname || "Member",
        email: memberDetails.email || user.email || "",
        phone: memberDetails.phone || user.phone || "",
        dob: memberDetails.dob || null,
        gender: memberDetails.gender || "",
        state: memberDetails.state || user.state || "",
        city: memberDetails.city || user.city || "",
        address: memberDetails.address || "",
      },
      startDate,
      endDate,
      paymentMethod: "cash",
      paymentStatus: safePaymentStatus,
      status: safePaymentStatus === "Failed" ? "Cancelled" : "Active",
      arrivalDate:
        safeArrivalStatus === "Approved"
          ? normalizedArrivalDate || new Date()
          : normalizedArrivalDate,
      arrivalStatus: safeArrivalStatus,
      physicalCardRequested: false,
      physicalCardIssued: false,
      qrTrackingToken,
      qrcodeURL: qrCodeUrl,
    };

    if (membershipNumber) {
      bookingPayload.membershipNumber = membershipNumber;
    }

    const booking = await MembershipBooking.create(bookingPayload);

    return res.status(201).json({
      success: true,
      message: "Offline booking created successfully",
      booking,
    });
  } catch (error) {
    console.error("createOfflineBookingByAdmin error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create offline booking",
    });
  }
};

const getbookedMembershipDetail = async (req, res) => {
  try {
    const userId = req.user._id;

    const booking = await MembershipBooking.findOne({
      userId: user._id,
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
      paymentStatus: "Completed",
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

    console.log("ARRIVAL_STATUS_REQUEST", { id, arrivalStatus, arrivalDate });

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
      console.log("FCM_SKIP_NO_TOKEN", {
        userId: String(updatedBooking.userId),
      });
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
          android: { priority: "high" },
          apns: { headers: { "apns-priority": "10" } },
        };

        const messageId = await admin.messaging().send(message);
        console.log("FCM_SENT", {
          userId: String(updatedBooking.userId),
          messageId,
        });
      } catch (err) {
        console.error("FCM_SEND_ERROR", {
          code: err?.code,
          message: err?.message,
          userId: String(updatedBooking.userId),
          tokenPrefix: user?.fcmToken?.slice(0, 20),
        });

        if (
          err?.code === "messaging/registration-token-not-registered" ||
          err?.code === "messaging/invalid-registration-token"
        ) {
          await User.findByIdAndUpdate(updatedBooking.userId, {
            $unset: { fcmToken: 1 },
          });
          console.log("FCM_TOKEN_REMOVED", {
            userId: String(updatedBooking.userId),
          });
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

const cancelUserArrivalRequest = async (req, res) => {
  try {
    const { bookingId } = req.body;
    const userId = req.user?._id;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "bookingId is required",
      });
    }

    const booking = await MembershipBooking.findOne({
      _id: bookingId,
      userId,
      status: "Active",
      paymentStatus: "Completed",
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Membership booking not found",
      });
    }

    if (booking.arrivalStatus !== "Pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending arrival request can be cancelled",
      });
    }

    const updatedBooking = await MembershipBooking.findOneAndUpdate(
      { _id: bookingId, userId, status: "Active" },
      { $set: { arrivalStatus: "NotRequested", arrivalDate: null } },
      { returnDocument: "after" },
    );

    return res.status(200).json({
      success: true,
      message: "Arrival request cancelled successfully",
      booking: updatedBooking,
    });
  } catch (error) {
    console.error("Cancel arrival request failed:", error);
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
      paymentStatus: "Completed",
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

const requestphysicalCard = async (req, res) => {
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

    const booking = await MembershipBooking.findOne({
      _id: bookingId,
      userId,
      status: "Active",
      paymentStatus: "Completed",
    });
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Active paid membership booking not found",
      });
    }

    // Optional hard guard if booking already marked requested
    if (booking.physicalCardRequested) {
      return res.status(409).json({
        success: false,
        message: "Physical card already requested",
      });
    }

    const existingPending = await PhysicalcardRequest.findOne({
      bookingId,
      status: "Pending",
    });

    if (existingPending) {
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

    const updatedBooking = await MembershipBooking.findByIdAndUpdate(
      bookingId,
      { physicalCardRequested: true },
      { new: true },
    );

    return res.status(201).json({
      success: true,
      message: "Physical card request submitted",
      data: cardRequest,
      booking: updatedBooking,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Unable to submit physical card request",
      error: error.message,
    });
  }
};

const completeOnlinePaymentReplacingCash = async (req, res) => {
  try {
    const {
      bookingId,
      razorpay_orderId,
      razorpay_paymentId,
      razorpay_signature,
    } = req.body;
    const userId = req.user._id;

    if (
      !bookingId ||
      !razorpay_orderId ||
      !razorpay_paymentId ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing online payment details",
      });
    }

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
      paymentStatus: "Completed",
      endDate: { $gte: new Date() },
      _id: { $ne: bookingId },
    });

    if (existingActive) {
      return res.status(409).json({
        success: false,
        message: "User already has an active membership",
        booking: existingActive,
      });
    }

    const pendingCashBooking = await MembershipBooking.findOne({
      _id: bookingId,
      userId,
      status: "Active",
      paymentStatus: "Pending",
      paymentMethod: "cash",
    });

    if (!pendingCashBooking) {
      return res.status(404).json({
        success: false,
        message: "Pending cash booking not found",
      });
    }

    pendingCashBooking.paymentMethod = "online";
    pendingCashBooking.paymentStatus = "Completed";
    pendingCashBooking.paymentDate = new Date();
    pendingCashBooking.razorpay_orderId = razorpay_orderId;
    pendingCashBooking.razorpay_paymentId = razorpay_paymentId;
    pendingCashBooking.razorpay_signature = razorpay_signature;
    await pendingCashBooking.save();

    await createNotification({
      userId,
      title: "Membership Activated",
      message: `Your membership is active till ${pendingCashBooking.endDate.toDateString()}`,
      type: "booking",
    });

    const user = await User.findById(userId);
    const firstName = user?.fullname?.trim().split(/\s+/)[0] || "Member";

    if (user?.fcmToken) {
      await admin.messaging().send({
        token: user.fcmToken,
        notification: {
          title: `Congratulations ${firstName}`,
          body: `Membership Activated. Your membership is active till ${pendingCashBooking.endDate.toDateString()}`,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Membership payment completed successfully",
      booking: pendingCashBooking,
    });
  } catch (error) {
    console.error("completeOnlinePaymentReplacingCash error", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

const updateBookingPaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;

    if (!["Pending", "Completed", "Failed"].includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment status",
      });
    }

    const booking = await MembershipBooking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Membership booking not found",
      });
    }

    booking.paymentStatus = paymentStatus;
    if (paymentStatus === "Completed") {
      booking.status = "Active";
      booking.paymentDate = new Date();
    } else if (paymentStatus === "Failed") {
      booking.status = "Cancelled";
    }

    await booking.save();

    if (paymentStatus === "Completed") {
      await createNotification({
        userId: booking.userId,
        title: "Membership Activated",
        message: `Your membership is active till ${booking.endDate.toDateString()}`,
        type: "booking",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payment status updated successfully",
      booking,
    });
  } catch (error) {
    console.error("updateBookingPaymentStatus error", error);
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
  cancelUserArrivalRequest,
  requestphysicalCard,
  updateBookingPaymentStatus,
  completeOnlinePaymentReplacingCash,
  createOfflineBookingByAdmin,
};
