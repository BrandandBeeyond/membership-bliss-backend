const { AdminLogin, CreateAdmin } = require("../controllers/admin.controller");
const { ProtectedAdmin, AuthorizeRoles } = require("../middlewares/admin.auth");

const adminRouter = require("express").Router();

adminRouter.post("/login", AdminLogin);

adminRouter.post(
  "/create-admin",
  ProtectedAdmin,
  AuthorizeRoles("SUPER_ADMIN"),
  CreateAdmin
);

module.exports = { adminRouter };
