const {
  createMembershipCategory,
} = require("../controllers/membershipcategory.controller");

const membershipCategoryRouter = require("express").Router();

membershipCategoryRouter.post("/add", createMembershipCategory);

module.exports = { membershipCategoryRouter };
