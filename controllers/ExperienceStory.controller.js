const Cloudinary = require("cloudinary");
const ExperienceStory = require("../models/Experiencestory.model");

const createExperienceStory = async (req, res) => {
  try {
    const { title, overviewText, types } = req.body;

    if (!title || !overviewText) {
      return res.status(400).json({
        success: false,
        message: "Title and overview text are required",
      });
    }

    if (!req.files?.coverImage?.[0]) {
      return res.status(400).json({
        success: false,
        message: "Cover image is required",
      });
    }

    const existing = await ExperienceStory.findOne({ title: title.trim() });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Experience with this title already exists",
      });
    }

    const coverUpload = await Cloudinary.v2.uploader.upload(
      req.files.coverImage[0].path,
      { folder: "experience/cover" },
    );

    const coverImage = {
      public_id: coverUpload.public_id,
      url: coverUpload.secure_url,
    };

    let stories = [];
    if (req.files?.stories) {
      for (const file of req.files.stories) {
        const upload = await Cloudinary.v2.uploader.upload(file.path, {
          folder: "experience/stories",
        });

        stories.push({
          image: {
            public_id: upload.public_id,
            url: upload.secure_url,
          },
        });
      }
    }

    let parsedTypes = [];
    if (types) {
      parsedTypes = typeof types === "string" ? JSON.parse(types) : types;

      parsedTypes = parsedTypes.map((t) => ({
        title: t.title,
        description: t.description,
        amenities: Array.isArray(t.amenities)
          ? t.amenities.map((a) => ({ title: a.title || a }))
          : [],
      }));
    }

    const experience = await ExperienceStory.create({
      title: title.trim(),
      overviewText,
      coverImage,
      stories,
      types: parsedTypes, // can be empty []
    });

    return res.status(201).json({
      success: true,
      message: "Experience story created successfully",
      data: experience,
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
    const { title, overviewText, types } = req.body;

    const experience = await ExperienceStory.findById(id);
    if (!experience) {
      return res.status(404).json({
        success: false,
        message: "Experience not found",
      });
    }

    if (title) experience.title = title.trim();
    if (overviewText) experience.overviewText = overviewText;

    if (req.files?.coverImage?.[0]) {
      const upload = await Cloudinary.v2.uploader.upload(
        req.files.coverImage[0].path,
        { folder: "experience/cover" },
      );

      experience.coverImage = {
        public_id: upload.public_id,
        url: upload.secure_url,
      };
    }

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

    if (types) {
      let parsedTypes = typeof types === "string" ? JSON.parse(types) : types;

      experience.types = parsedTypes.map((t) => ({
        title: t.title,
        description: t.description,
        amenities: Array.isArray(t.amenities)
          ? t.amenities.map((a) => ({ title: a.title || a }))
          : [],
      }));
    }

    await experience.save();

    return res.status(200).json({
      success: true,
      message: "Experience story updated successfully",
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
