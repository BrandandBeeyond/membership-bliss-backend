const {
  AdminLogin,
  CreateAdmin,
  AdminLogout,
  getAdminDetails,
} = require("../controllers/admin.controller");
const { ProtectedAdmin, AuthorizeRoles } = require("../middlewares/admin.auth");

const adminRouter = require("express").Router();

adminRouter.post("/login", AdminLogin);

adminRouter.post(
  "/create-admin",
  ProtectedAdmin,
  AuthorizeRoles("SUPER_ADMIN"),
  CreateAdmin
);

adminRouter.get("/get-admin-details", ProtectedAdmin, getAdminDetails);

adminRouter.post("/admin-logout", ProtectedAdmin, AdminLogout);
module.exports = { adminRouter };
