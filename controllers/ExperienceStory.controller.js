const Cloudinary = require("cloudinary");
const ExperienceStory = require("../models/Experiencestory.model");

const createExperienceStory = async (req, res) => {
  try {
    const { title, overviewText, order, isActive, includedCategories } =
      req.body;

    if (!title || !overviewText) {
      return res.status(400).json({
        success: false,
        message: "title and overview text is required",
      });
    }

    if (
      !req.files ||
      !req.files["coverImage"] ||
      req.files["coverImage"].length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Cover image is required",
      });
    }

    const coverfile = req.files["coverImage"][0];

    const coverUpload = await Cloudinary.v2.uploader.upload(coverfile.path, {
      folder: "experience/cover",
    });

    const coverImage = {
      public_id: coverUpload.public_id,
      url: coverUpload.secure_url,
    };

    let stories = [];

    if (req.files["stories"]) {
      for (const file of req.files["stories"]) {
        const storyUpload = await Cloudinary.v2.uploader.upload(file.path, {
          folder: "experience/stories",
        });

        stories.push({
          image: {
            public_id: storyUpload.public_id,
            url: storyUpload.secure_url,
          },
        });
      }
    }

    const exisitingStory = await ExperienceStory.findOne({
      title,
    });

    if (exisitingStory) {
      return res.status(400).json({
        success: false,
        message: "Experience with this title already exists",
      });
    }

    let parsedCategories = [];

    if (includedCategories) {
      parsedCategories =
        typeof includedCategories === "string"
          ? JSON.parse(includedCategories)
          : includedCategories;
    }

    const newExperience = new ExperienceStory({
      title: title.trim(),
      coverImage,
      stories,
      includedCategories: parsedCategories,
      order: order || 0,
      isActive: isActive !== undefined ? isActive : true,
    });

    await newExperience.save();

    return res.status(201).json({
      success: true,
      message: "Experience story created successfully",
      data: newExperience,
    });
  } catch (error) {
    console.error("Create Experience Failed:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const updateExperienceStory = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, overviewText, order, isActive, includedCategories } =
      req.body;

    const experience = await ExperienceStory.findById(id);

    if (!experience) {
      return res.status(404).json({
        success: false,
        message: "Experience not found",
      });
    }

    if (title) experience.title = title.trim();
    if (overviewText) experience.overviewText = overviewText;

    /* ---------- Update Cover Image ---------- */
    if (req.files?.coverImage) {
      const coverFile = req.files.coverImage[0];

      const upload = await Cloudinary.v2.uploader.upload(coverFile.path, {
        folder: "experience/cover",
      });

      experience.coverImage = {
        public_id: upload.public_id,
        url: upload.secure_url,
      };
    }

    /* ---------- Add Stories ---------- */
    if (req.files?.stories) {
      for (const file of req.files.stories) {
        const upload = await Cloudinary.v2.uploader.upload(file.path, {
          folder: "experience/stories",
        });

        experience.stories.push({
          image: {
            public_id: upload.public_id,
            url: upload.secure_url,
          },
        });
      }
    }

    /* ---------- Update Included Categories ---------- */
    if (includedCategories) {
      experience.includedCategories =
        typeof includedCategories === "string"
          ? JSON.parse(includedCategories)
          : includedCategories;
    }

    if (order !== undefined) experience.order = Number(order);
    if (isActive !== undefined)
      experience.isActive = isActive === true || isActive === "true";

    await experience.save();

    return res.status(200).json({
      success: true,
      message: "Experience updated successfully",
      data: experience,
    });
  } catch (error) {
    console.error("Update Experience Failed:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const getAllExperienceStories = async (req, res) => {
  try {
    const experiences = await ExperienceStory.find().sort({ order: 1 });

    return res.status(200).json({
      success: true,
      data: experiences,
    });
  } catch (error) {
    console.error("Fetch Experiences Failed:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

module.exports = {
  createExperienceStory,
  updateExperienceStory,
  getAllExperienceStories,
};
