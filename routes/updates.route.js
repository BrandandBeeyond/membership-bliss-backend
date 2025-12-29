const upload = require("../config/multerConfig");
const {
  createUpdates,
  getAllUpdates,
} = require("../controllers/update.controller");

const updatesRouter = require("express").Router();

updatesRouter.post(
  "/addupdate",
  upload.fields([
    { name: "icon", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  createUpdates
);
updatesRouter.get("/getall", getAllUpdates);

module.exports = { updatesRouter };
