const mongoose = require("mongoose");

const ImageSchema = {
  public_id: String,
  url: String,
};

const AmenitySchema = {
  title: {
    type: String,
  },
  icon: ImageSchema,
};

const CategoryItemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
    },
    description: {
      type: String,
    },
    image: ImageSchema,

    amenities: [AmenitySchema],
  },
  { _id: false },
);

const IncludedCategorySchema = new mongoose.Schema(
  {
    categoryKey: {
      type: String,
      required: true,
    },

    overviewText: {
      type: String,
      required: true,
    },

    items: [CategoryItemSchema],
  },
  { _id: false },
);

const ExperienceStorySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    coverImage: {
      public_id: {
        type: String,
        required: true,
      },
      url: {
        type: String,
        required: true,
      },
    },

    overviewText: {
      type: String,
      required: true,
    },

    stories: [
      {
        image: ImageSchema,
      },
    ],

    includedCategories: [IncludedCategorySchema],

    order: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

const ExperienceStory = mongoose.model(
  "ExperienceStory",
  ExperienceStorySchema,
);

module.exports = ExperienceStory;
