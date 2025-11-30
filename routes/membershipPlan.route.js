const {
  createMembershipPlan,
  getallMembershipPlans,
  getMemberShipById,
} = require("../controllers/membershipplan.controller");

const membershipPlanRouter = require("express").Router();

membershipPlanRouter.post("/add", createMembershipPlan);
membershipPlanRouter.post("/", getallMembershipPlans);
membershipPlanRouter.post("/:id", getMemberShipById);

module.exports = { membershipPlanRouter };
