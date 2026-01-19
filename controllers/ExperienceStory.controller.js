const Cloudinary = require("cloudinary");
const ExperienceStory = require("../models/Experiencestory.model");

const createExperienceStory = async (req, res) => {
  try {
    const { title, order, isActive } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "title is required",
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

    const newExperience = new ExperienceStory({
      title,
      coverImage,
      stories,
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

module.exports = { createExperienceStory };
