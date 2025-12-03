const upload = require("../config/multerConfig");
const {
  createMembershipCategory,
  getAllCategories,
} = require("../controllers/membershipcategory.controller");

const membershipCategoryRouter = require("express").Router();

membershipCategoryRouter.post(
  "/add",
  upload.fields([{ name: "thumbnail", maxCount: 1 }]),
  createMembershipCategory
);

membershipCategoryRouter.get("/getall", getAllCategories);

module.exports = { membershipCategoryRouter };
