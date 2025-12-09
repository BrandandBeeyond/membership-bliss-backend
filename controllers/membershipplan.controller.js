const MembershipCategory = require("../models/MembershipCategory.model");
const MembershipPlan = require("../models/MembershipPlan.model");
const Cloudinary = require("cloudinary");

const createMembershipPlan = async (req, res) => {
  try {
    let {
      categoryId,
      name,
      price,
      validityinDays,
      policyDetails,
      benefits,
      discountDetails,
      offers,
      colorScheme,
    } = req.body;

    if (!categoryId || !name || !price || !colorScheme) {
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
      let cleaned = benefits.replace(/[\[\]]/g, "");

      cleaned = cleaned
        .split(/"\s*"/)
        .map((item) => item.replace(/"/g, "").trim());

      benefits = cleaned.filter((item) => item.length > 0);
    }

    if (typeof policyDetails === "string") {
      try {
        const parsed = JSON.parse(policyDetails);

        policyDetails = parsed.map((item) => ({
          title: item.title ? item.title.trim() : item.trim(),
        }));
      } catch (err) {
        let cleaned = policyDetails
          .replace(/^\[/, "")
          .replace(/\]$/, "")
          .trim();

        cleaned = cleaned.split(/}\s*,\s*{/).map((block) => {
          let text = block
            .replace("{", "")
            .replace("}", "")
            .replace(/"title":/g, "")
            .replace(/"/g, "")
            .trim();

          return { title: text };
        });

        policyDetails = cleaned;
      }
    }

    if (typeof discountDetails === "string") {
      discountDetails = discountDetails.split(",").map((item) => item.trim());
    }

    if (typeof offers === "string") {
      offers = JSON.parse(offers);
    }

    if (
      !req.files ||
      !req.files["thumbnail"] ||
      req.files["thumbnail"].length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Thumbnail is required",
      });
    }

    if (
      !req.files ||
      !req.files["images"] ||
      req.files["images"].length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "At least one image is required",
      });
    }

    const planImages = [];

    for (const imageFile of req.files["images"]) {
      const imageResult = await Cloudinary.v2.uploader.upload(imageFile.path, {
        folder: "plan/membershipcarousel",
      });

      planImages.push({
        public_id: imageResult.public_id,
        url: imageResult.secure_url,
      });
    }

    const thumbnailFile = req.files["thumbnail"][0];
    const thumbnailUpload = await Cloudinary.v2.uploader.upload(
      thumbnailFile.path,
      {
        folder: "plan/membershipthumbnail",
      }
    );

    const thumbnail = {
      public_id: thumbnailUpload.public_id,
      url: thumbnailUpload.secure_url,
    };

    const membershipPlanExist = await MembershipPlan.findOne({
      name: name.trim(),
    });

    if (membershipPlanExist) {
      return res.status(400).json({
        success: false,
        message: "Membership plan with this name already exists",
      });
    }

    const newPlan = new MembershipPlan({
      categoryId,
      name: name.trim(),
      thumbnail,
      colorScheme,
      price,
      validityinDays: validityinDays || 365,
      policyDetails: policyDetails || [],
      benefits: benefits || [],
      discountDetails: discountDetails || [],
      offers: offers || [],
      images: planImages,
    });

    await newPlan.save();

    return res.status(201).json({
      success: true,
      message: "Membership plan created successfully",
      membershipPlan: newPlan,
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

const getMembershipPlansByOffersId = async (req, res) => {
  try {
    const { id } = req.params;

    const plan = await MembershipPlan.findById(id)
      .populate("categoryId")
      .populate({
        path: "offers",
        model: "OfferCategory",
        select: "title thumbnail items",
      });

    if (!plan) {
      return res
        .status(400)
        .json({ success: false, message: "plan not found" });
    }

    return res.status(200).json({
      success: true,
      plans:plan.offers,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

module.exports = {
  createMembershipPlan,
  getallMembershipPlans,
  getMemberShipById,
  getMembershipPlansByOffersId,
};
