const MembershipCategory = require("../models/MembershipCategory.model");
const MembershipPlan = require("../models/MembershipPlan.model");

const createMembershipPlan = async (req, res) => {
  try {
    const {
      categoryId,
      name,
      price,
      validityinDays,
      benefits,
      usageLimit,
      discountDetails,
      offers,
    } = req.body;

    const category = await MembershipCategory.findById(categoryId);

    if (!category) {
      return res
        .status(404)
        .json({ success: false, message: "Membership category not found" });
    }

    const plan = new MembershipPlan({
      categoryId,
      name,
      price,
      validityinDays,
      benefits,
      usageLimit,
      discountDetails,
      offers,
    });

    await plan.save();

    return res.status(201).json({
      success: true,
      message: "Membership plan created successfully",
      membershipPlan,
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
