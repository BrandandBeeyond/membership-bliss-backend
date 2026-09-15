function makeAdminManagement(Admin) {
  const validId = (id) => typeof id === "string" && /^[a-f0-9]{24}$/i.test(id);
  const safeAdmin = (admin) => ({ _id: admin._id, name: admin.name, email: admin.email, role: admin.role, isActive: admin.isActive, createdAt: admin.createdAt });
  async function updateAdmin(req, res) {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid admin ID" });
    const { name, email, password, isActive } = req.body || {};
    if (typeof name !== "string" || !name.trim() || name.trim().length > 100 || typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || (password !== undefined && password !== "" && (typeof password !== "string" || password.length < 8 || Buffer.byteLength(password) > 72)) || (isActive !== undefined && typeof isActive !== "boolean")) {
      return res.status(400).json({ success: false, message: "Enter a valid name, email and status. A new password must be at least 8 characters (maximum 72 bytes)." });
    }
    if (String(req.admin._id) === req.params.id) return res.status(403).json({ success: false, message: "Use your own account settings to change your account" });
    try {
      const admin = await Admin.findOne({ _id: req.params.id, role: { $ne: "SUPER_ADMIN" } });
      if (!admin) return res.status(404).json({ success: false, message: "Admin not found or account is protected" });
      admin.name = name.trim();
      admin.email = email.trim().toLowerCase();
      if (password) admin.password = password; // save runs the existing bcrypt hook.
      if (isActive !== undefined) admin.isActive = isActive;
      await admin.save();
      return res.status(200).json({ success: true, message: "Admin updated successfully", admin: safeAdmin(admin) });
    } catch (error) {
      return res.status(error.code === 11000 ? 409 : 500).json({ success: false, message: error.code === 11000 ? "An admin with this email already exists" : "Unable to update admin" });
    }
  }
  async function deleteAdmin(req, res) {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid admin ID" });
    if (String(req.admin._id) === req.params.id) return res.status(403).json({ success: false, message: "You cannot delete your own account" });
    try {
      const admin = await Admin.findOneAndDelete({ _id: req.params.id, role: { $ne: "SUPER_ADMIN" } });
      if (!admin) return res.status(404).json({ success: false, message: "Admin not found or account is protected" });
      return res.status(200).json({ success: true, message: "Admin deleted successfully" });
    } catch {
      return res.status(500).json({ success: false, message: "Unable to delete admin" });
    }
  }
  return { updateAdmin, deleteAdmin };
}

module.exports = { makeAdminManagement };
