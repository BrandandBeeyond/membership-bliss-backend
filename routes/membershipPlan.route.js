const upload = require("../config/multerConfig");
const {
  createMembershipPlan,
  getallMembershipPlans,
  getMemberShipById,
  getMembershipPlansByOffersId,
} = require("../controllers/membershipplan.controller");

const membershipPlanRouter = require("express").Router();

membershipPlanRouter.post(
  "/add",
  upload.fields([
    { name: "thumbnail", maxCount: 1 },
    { name: "images", maxCount: 5 },
  ]),
  createMembershipPlan
);
membershipPlanRouter.get("/getall", getallMembershipPlans);
membershipPlanRouter.get("/:id", getMemberShipById);
membershipPlanRouter.get("/details/:id", getMembershipPlansByOffersId);

module.exports = { membershipPlanRouter };
