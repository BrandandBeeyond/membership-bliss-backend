// "Updates" shown in the member app (What's new / Events & retreats).
// Listing is public for the app; create/edit/delete are admin-only (see routes/updates.route.js).

const CATEGORIES = ["whats_new", "events_retreats"];
const isObjectId = (value) => /^[a-f0-9]{24}$/i.test(String(value || ""));
const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

function readFields(body = {}, { partial = false } = {}) {
  const fields = {};
  const errors = [];
  if (!partial || body.title !== undefined) {
    fields.title = text(body.title, 120);
    if (!fields.title) errors.push("Title is required");
  }
  if (!partial || body.description !== undefined) {
    fields.description = text(body.description, 5000);
    if (!fields.description) errors.push("Description is required");
  }
  if (!partial || body.category !== undefined) {
    fields.category = body.category;
    if (!CATEGORIES.includes(fields.category)) errors.push("Category must be What's new or Events & retreats");
  }
  if (body.updatedOn !== undefined && body.updatedOn !== "") {
    const date = new Date(body.updatedOn);
    if (Number.isNaN(date.getTime())) errors.push("Invalid date");
    else fields.updatedOn = date;
  }
  return { fields, error: errors[0] };
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function makeUpdatesAdmin({ Updates, uploadImage, deleteImage, removeTempFile = async () => {} }) {
  const thumbnailFile = (req) => req.files?.thumbnail?.[0] || null;
  const cleanup = async (req) => { const file = thumbnailFile(req); if (file?.path) await removeTempFile(file.path); };
  const titleTaken = (title, exceptId) => Updates.findOne({ title: new RegExp(`^${escapeRegex(title)}$`, "i"), ...(exceptId ? { _id: { $ne: exceptId } } : {}) });

  const list = async (_req, res) => {
    try {
      const updates = await Updates.find().sort({ updatedOn: -1, createdAt: -1 });
      return res.status(200).json({ success: true, message: "Updates data", updates });
    } catch (error) {
      console.error("Updates list failed:", error?.message);
      return res.status(500).json({ success: false, message: "Unable to load updates" });
    }
  };

  const create = async (req, res) => {
    try {
      const { fields, error } = readFields(req.body);
      if (error) return res.status(400).json({ success: false, message: error });
      const file = thumbnailFile(req);
      if (!file) return res.status(400).json({ success: false, message: "Thumbnail image is required" });
      if (await titleTaken(fields.title)) return res.status(409).json({ success: false, message: "An update with this title already exists" });
      const image = await uploadImage(file.path);
      const update = await Updates.create({ ...fields, thumbnail: image, updatedOn: fields.updatedOn || new Date() });
      return res.status(201).json({ success: true, update });
    } catch (error) {
      console.error("Update create failed:", error?.message);
      return res.status(500).json({ success: false, message: "Unable to save update" });
    } finally {
      await cleanup(req);
    }
  };

  const edit = async (req, res) => {
    try {
      const { id } = req.params;
      if (!isObjectId(id)) return res.status(400).json({ success: false, message: "Invalid update ID" });
      const existing = await Updates.findById(id);
      if (!existing) return res.status(404).json({ success: false, message: "Update not found" });
      const { fields, error } = readFields(req.body, { partial: true });
      if (error) return res.status(400).json({ success: false, message: error });
      if (fields.title && await titleTaken(fields.title, id)) return res.status(409).json({ success: false, message: "An update with this title already exists" });

      const file = thumbnailFile(req);
      const previousImageId = existing.thumbnail?.public_id;
      if (file) fields.thumbnail = await uploadImage(file.path);
      if (fields.updatedOn === undefined) fields.updatedOn = new Date();

      const update = await Updates.findByIdAndUpdate(id, { $set: fields }, { returnDocument: "after", runValidators: true });
      // Remove the replaced image only after the record points at the new one.
      if (file && previousImageId) await deleteImage(previousImageId).catch((e) => console.error("Old thumbnail delete failed:", e?.message));
      return res.status(200).json({ success: true, update });
    } catch (error) {
      console.error("Update edit failed:", error?.message);
      return res.status(500).json({ success: false, message: "Unable to save update" });
    } finally {
      await cleanup(req);
    }
  };

  const remove = async (req, res) => {
    try {
      const { id } = req.params;
      if (!isObjectId(id)) return res.status(400).json({ success: false, message: "Invalid update ID" });
      const deleted = await Updates.findByIdAndDelete(id);
      if (!deleted) return res.status(404).json({ success: false, message: "Update not found" });
      if (deleted.thumbnail?.public_id) await deleteImage(deleted.thumbnail.public_id).catch((e) => console.error("Thumbnail delete failed:", e?.message));
      return res.status(200).json({ success: true, deletedId: id });
    } catch (error) {
      console.error("Update delete failed:", error?.message);
      return res.status(500).json({ success: false, message: "Unable to delete update" });
    }
  };

  return { list, create, edit, remove };
}

module.exports = { makeUpdatesAdmin, CATEGORIES };
