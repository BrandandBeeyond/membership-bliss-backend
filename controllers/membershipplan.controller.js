const MembershipCategory = require("../models/MembershipCategory.model");
const MembershipPlan = require("../models/MembershipPlan.model");

const createMembershipPlan = async (req, res) => {
  try {
    let {
      categoryId,
      name,
      price,
      validityinDays,
      policyDetails,
      benefits,
      usageLimit,
      discountDetails,
      offers,
    } = req.body;

    if (!categoryId || !name || !price) {
      return res.status(400).json({
        success: false,
        message: "categoryId, name and price are required",
      });
    }

    const categoryExists = await MembershipCategory.findById(categoryId);

    if (!categoryExists) {
      return res
        .status(404)
        .json({ success: false, message: "Membership category not found" });
    }

    if (typeof benefits === "string") {
      benefits = benefits.split(",").map((item) => item.trim());
    }

    if (typeof policyDetails === "string") {
      policyDetails = policyDetails.split(",").map((item) => item.trim());
    }

    if (typeof discountDetails === "string") {
      discountDetails = discountDetails.split(",").map((item) => item.trim());
    }

    if (typeof offers === "string") {
      offers = JSON.parse(offers);
    }

    const newPlan = new MembershipPlan({
      categoryId,
      name,
      price,
      validityinDays: validityinDays || 365,
      policyDetails: policyDetails || [],
      benefits: benefits || [],
      usageLimit,
      discountDetails: discountDetails || [],
      offers: offers || [],
    });

    return res.status(201).json({
      success: true,
      message: "Membership plan created successfully",
      membershipPlan: await newPlan.save(),
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server error", error: error.message });
    console.error("Membership plan creation failed", error);
  }
};

const getallMembershipPlans = async (req, res) => {
  try {
    const plans = await MembershipPlan.find().populate(
      "categoryId",
      "name thumbnail"
    );
    return res.status(200).json({
      success: true,
      membershipPlans: plans,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server error", error: error.message });
    console.error("Fetching membership plans failed", error);
  }
};

const getMemberShipById = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await MembershipPlan.findById(id).populate(
      "categoryId",
      "name thumbnail"
    );

    if (!plan) {
      return res
        .status(404)
        .json({ success: false, message: "Membership plan not found" });
    }

    return res.status(200).json({ success: true, membershipPlan: plan });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server error", error: error.message });
    console.error("Fetching membership plan failed", error);
  }
};

module.exports = {
  createMembershipPlan,
  getallMembershipPlans,
  getMemberShipById,
};
