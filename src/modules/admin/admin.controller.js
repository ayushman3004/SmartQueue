import User from "../auth/auth.model.js";
import Business from "../business/business.model.js";
import Appointment from "../../booking/booking.model.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import * as businessService from "../business/business.service.js";

export const getStats = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json(new ApiResponse(403, null, "Forbidden"));
  
  const [userCount, businessCount, bookingCount] = await Promise.all([
    User.countDocuments(),
    Business.countDocuments(),
    Appointment.countDocuments(),
  ]);

  const recentBusinesses = await Business.find().sort({ createdAt: -1 }).limit(5).populate("owner", "name email");
  const recentBookings = await Appointment.find().sort({ createdAt: -1 }).limit(5).populate("userId", "name");

  res.json(new ApiResponse(200, {
    stats: { users: userCount, businesses: businessCount, bookings: bookingCount },
    recent: { businesses: recentBusinesses, bookings: recentBookings }
  }, "Stats retrieved successfully"));
});

export const toggleBusinessStatus = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json(new ApiResponse(403, null, "Forbidden"));
  const { id } = req.params;
  const business = await Business.findById(id);
  if (!business) {
    return res.status(404).json(new ApiResponse(404, null, "Business not found"));
  }
  business.isActive = !business.isActive;
  if (!business.isActive) {
    business.isOpen = false; // Force close if deactivated
  }
  await business.save();

  const io = req.app.get("io");
  if (io) {
    io.emit("business:status", {
      businessId: business._id,
      isActive: business.isActive,
      isOpen: business.isOpen,
      name: business.name,
      category: business.category,
      message: business.isActive 
        ? `Moderation: ${business.name} has been reactivated.` 
        : `Moderation: ${business.name} access has been suspended by administration.`
    });
  }

  res.json(new ApiResponse(200, { business }, `Business is now ${business.isActive ? "active" : "deactivated"}`));
});

export const deleteBusiness = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json(new ApiResponse(403, null, "Forbidden"));
  const { id } = req.params;
  
  await businessService.deleteBusiness(id);

  const io = req.app.get("io");
  if (io) {
    io.emit("business:deleted", { businessId: id });
  }

  res.json(new ApiResponse(200, null, "Business permanently deleted"));
});
