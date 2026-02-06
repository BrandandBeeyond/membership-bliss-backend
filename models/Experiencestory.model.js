const mongoose = require("mongoose");

const ImageSchema = {
  public_id: String,
  url: String,
};

const AmenitySchema = {
  title: {
    type: String,
    required: true,
  },
  icon: ImageSchema,
};

const ExperienceTypeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    image: ImageSchema,
    amenities: [AmenitySchema],
  },
  { _id: false }
);

const ExperienceStorySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    overviewText: {
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

    stories: [
      {
        image: ImageSchema,
      },
    ],

   
    types: {
      type: [ExperienceTypeSchema],
      default: [],
    },

    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ExperienceStory", ExperienceStorySchema);
