const upload = require("../config/multerConfig");
const {
  createMembershipPlan,
  getallMembershipPlans,
  getMemberShipById,
} = require("../controllers/membershipplan.controller");

const membershipPlanRouter = require("express").Router();

membershipPlanRouter.post(
  "/add",
  upload.fields([{ name: "images", maxCount: 5 }]),
  createMembershipPlan
);
membershipPlanRouter.post("/", getallMembershipPlans);
membershipPlanRouter.post("/:id", getMemberShipById);

module.exports = { membershipPlanRouter };
