const upload = require("../config/multerConfig");
const {
  createExperienceStory,
  updateExperienceStory,
} = require("../controllers/ExperienceStory.controller");
const { ProtectedAdmin, AuthorizeRoles } = require("../middlewares/admin.auth");

const experienceStoryRouter = require("express").Router();

experienceStoryRouter.post(
  "/addstory",
  upload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "stories", maxCount: 10 },
  ]),
  ProtectedAdmin,
  AuthorizeRoles("ADMIN", "SUPER_ADMIN"),
  createExperienceStory,
);

experienceStoryRouter.put(
  "/update/:id",
  ProtectedAdmin,
  AuthorizeRoles("ADMIN", "SUPER_ADMIN"),
  updateExperienceStory,
);

module.exports = { experienceStoryRouter };
