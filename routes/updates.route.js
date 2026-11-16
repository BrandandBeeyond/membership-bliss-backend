const multer = require("multer");
const baseUpload = require("../config/multerConfig");
const { createUpdates, getAllUpdates, editUpdate, deleteUpdate } = require("../controllers/update.controller");
const { ProtectedAdmin, AuthorizeRoles } = require("../middlewares/admin.auth");

const updatesRouter = require("express").Router();

// Same disk storage as other uploads, limited to images up to 5 MB.
const imageUpload = multer({
  storage: baseUpload.storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype)),
}).fields([{ name: "thumbnail", maxCount: 1 }]);

const withImage = (req, res, next) => imageUpload(req, res, (error) => {
  if (!error) return next();
  const message = error.code === "LIMIT_FILE_SIZE" ? "Image must be 5 MB or smaller" : "Could not read the uploaded image";
  return res.status(400).json({ success: false, message });
});

const admins = [ProtectedAdmin, AuthorizeRoles("SUPER_ADMIN", "ADMIN")];

// Public: the member app reads this list.
updatesRouter.get("/getall", getAllUpdates);

updatesRouter.post("/addupdate", ...admins, withImage, createUpdates);
updatesRouter.put("/update/:id", ...admins, withImage, editUpdate);
updatesRouter.delete("/update/:id", ...admins, deleteUpdate);

module.exports = { updatesRouter };
