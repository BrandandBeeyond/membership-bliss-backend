const fs = require("fs/promises");
const Cloudinary = require("cloudinary");
const Updates = require("../models/Updates.model");
const { makeUpdatesAdmin } = require("../services/updates-admin");

const updatesAdmin = makeUpdatesAdmin({
  Updates,
  uploadImage: async (path) => {
    const result = await Cloudinary.v2.uploader.upload(path, { folder: "updates/thumbnail" });
    return { public_id: result.public_id, url: result.secure_url };
  },
  deleteImage: (publicId) => Cloudinary.v2.uploader.destroy(publicId),
  removeTempFile: (path) => fs.unlink(path).catch(() => {}),
});

module.exports = {
  getAllUpdates: updatesAdmin.list,
  createUpdates: updatesAdmin.create,
  editUpdate: updatesAdmin.edit,
  deleteUpdate: updatesAdmin.remove,
};
