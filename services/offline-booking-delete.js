function makeDeleteOfflineBooking({ MembershipBooking }) {
  return async (req, res) => {
    if (!/^[a-f0-9]{24}$/i.test(req.params.id || "")) {
      return res.status(400).json({ success: false, message: "Invalid booking ID" });
    }
    try {
      const booking = await MembershipBooking.findOneAndDelete({ _id: req.params.id, paymentMethod: "cash" });
      if (!booking) return res.status(404).json({ success: false, message: "Offline booking not found" });
      return res.status(200).json({ success: true, bookingId: booking._id, message: "Offline booking deleted successfully" });
    } catch {
      return res.status(500).json({ success: false, message: "Unable to delete offline booking" });
    }
  };
}
module.exports = { makeDeleteOfflineBooking };
