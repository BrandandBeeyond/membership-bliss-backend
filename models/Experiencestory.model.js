const mongoose = require("mongoose");

const ExperienceStorySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  coverImage: {
    public_id: {
      type: String,
      required: [true, "Please upload cover image"],
    },
    url: {
      type: String,
      required: [true, "Please upload cover image"],
    },
  },
  stories: [
    {
      image: {
        public_id: {
          type: String,
          required: [false, "Please upload story image"],
        },
        url: {
          type: String,
          required: [false, "Please upload story image"],
        },
      },
    },
  ],
  order: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

const ExperienceStory = mongoose.model(
  "ExperienceStory",
  ExperienceStorySchema,
);

module.exports = ExperienceStory;
