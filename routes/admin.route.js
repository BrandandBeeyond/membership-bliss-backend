const {
  AdminLogin,
  CreateAdmin,
  AdminLogout,
  getAdminDetails,
  getAllAdmins,
} = require("../controllers/admin.controller");
const { ProtectedAdmin, AuthorizeRoles } = require("../middlewares/admin.auth");

const adminRouter = require("express").Router();
const { makeAdminManagement } = require("../controllers/admin-management.controller");
const { updateAdmin, deleteAdmin } = makeAdminManagement(require("../models/Admin.model"));

adminRouter.post("/login", AdminLogin);

adminRouter.post(
  "/create-admin",
  ProtectedAdmin,
  AuthorizeRoles("SUPER_ADMIN"),
  CreateAdmin
);

adminRouter.get("/get-admin-details", ProtectedAdmin, getAdminDetails);

adminRouter.get(
  "/admins",
  ProtectedAdmin,
  AuthorizeRoles("SUPER_ADMIN"),
  getAllAdmins
);

adminRouter.put("/admins/:id", ProtectedAdmin, AuthorizeRoles("SUPER_ADMIN"), updateAdmin);
adminRouter.delete("/admins/:id", ProtectedAdmin, AuthorizeRoles("SUPER_ADMIN"), deleteAdmin);

adminRouter.post("/admin-logout", ProtectedAdmin, AdminLogout);
module.exports = { adminRouter };
