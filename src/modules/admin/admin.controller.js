import mongoose from "mongoose";
import User from "../auth/auth.model.js";
import Business from "../business/business.model.js";
import Booking from "../../booking/booking.model.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import ApiError from "../../../utils/ApiError.js";
import * as businessService from "../business/business.service.js";
import {
  isUserOnline,
  isHubOnline,
  getOnlineUserIds,
  getOnlineHubIds,
} from "../../../realtime/socket.js";

export const getStats = asyncHandler(async (_req, res) => {
  const [userCount, businessCount, bookingCount, completedBookings] = await Promise.all([
    User.countDocuments(),
    Business.countDocuments(),
    Booking.countDocuments(),
    Booking.find({ status: "completed" }),
  ]);

  const totalSystemRevenue = completedBookings.reduce((sum, b) => sum + (b.paidAmount || 0) + (b.extraCharge || 0), 0);
  const recentBusinesses = await Business.find().sort({ createdAt: -1 }).limit(5).populate("owner", "name email phone");
  const recentBookings = await Booking.find().sort({ createdAt: -1 }).limit(6).populate("userId", "name email").populate("businessId", "name category");

  const onlineUserIds = getOnlineUserIds();
  const onlineHubIds = getOnlineHubIds();

  res.json(new ApiResponse(200, {
    stats: {
      users: userCount,
      businesses: businessCount,
      bookings: bookingCount,
      revenue: totalSystemRevenue,
      onlineUsers: onlineUserIds.length,
      onlineHubs: onlineHubIds.length,
    },
    recent: { businesses: recentBusinesses, bookings: recentBookings },
  }, "Admin stats retrieved successfully"));
});

export const getAllBusinesses = asyncHandler(async (req, res) => {
  const { search, status } = req.query;
  const filter = {};
  if (search) {
    const regex = { $regex: search, $options: "i" };
    filter.$or = [{ name: regex }, { category: regex }, { location: regex }, { address: regex }];
  }

  const businesses = await Business.find(filter)
    .populate("owner", "name email phone")
    .sort({ createdAt: -1 });

  // Enrich with booking revenue, queue counts, and online presence
  let enriched = await Promise.all(
    businesses.map(async (b) => {
      const [queue, bookings] = await Promise.all([
        mongoose.model("Queue").findOne({ businessId: b._id }),
        Booking.find({ businessId: b._id }),
      ]);
      const completed = bookings.filter((bk) => bk.status === "completed");
      const revenue = completed.reduce((sum, bk) => sum + (bk.paidAmount || 0) + (bk.extraCharge || 0), 0);
      const isOnline = isHubOnline(b._id.toString(), b.owner?._id?.toString() || b.owner?.toString());

      return {
        ...b.toObject(),
        queueLength: queue?.users?.length || 0,
        bookingCount: bookings.length,
        completedCount: completed.length,
        revenue,
        isOnline,
      };
    })
  );

  if (status === "online") {
    enriched = enriched.filter((b) => b.isOnline);
  } else if (status === "offline") {
    enriched = enriched.filter((b) => !b.isOnline);
  }

  res.json(new ApiResponse(200, {
    businesses: enriched,
    onlineCount: enriched.filter((b) => b.isOnline).length,
    totalCount: enriched.length,
  }));
});

export const getBusinessDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const business = await Business.findById(id).populate("owner", "name email phone avatar");
  if (!business) throw new ApiError(404, "Business not found");

  const [queue, bookings] = await Promise.all([
    mongoose.model("Queue").findOne({ businessId: id }).populate("users.userId", "name email phone"),
    Booking.find({ businessId: id }).populate("userId", "name email phone").sort({ createdAt: -1 }),
  ]);

  const completed = bookings.filter((b) => b.status === "completed");
  const totalRevenue = completed.reduce((sum, b) => sum + (b.paidAmount || 0) + (b.extraCharge || 0), 0);
  const customers = Array.from(
    new Map(bookings.filter((b) => b.userId).map((b) => [b.userId._id.toString(), b.userId])).values()
  );

  res.json(new ApiResponse(200, {
    business,
    queue: queue || { users: [] },
    bookings,
    customers,
    revenue: totalRevenue,
  }));
});

export const moderateBusiness = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { action, approvalStatus, isActive, isOpen } = req.body;
  const business = await Business.findById(id);
  if (!business) throw new ApiError(404, "Business not found");

  if (action === "approve") {
    business.approvalStatus = "approved";
    business.isActive = true;
  } else if (action === "suspend") {
    business.approvalStatus = "suspended";
    business.isActive = false;
    business.isOpen = false;
  } else if (action === "close") {
    business.isOpen = false;
  } else if (action === "open") {
    business.isOpen = true;
  } else {
    if (approvalStatus !== undefined) business.approvalStatus = approvalStatus;
    if (isActive !== undefined) {
      business.isActive = Boolean(isActive);
      if (!business.isActive) business.isOpen = false;
    }
    if (isOpen !== undefined) business.isOpen = Boolean(isOpen);
  }

  await business.save();

  const io = req.app.get("io");
  if (io) {
    io.emit("business:status", {
      businessId: business._id,
      isActive: business.isActive,
      isOpen: business.isOpen,
      approvalStatus: business.approvalStatus,
      name: business.name,
      category: business.category,
      message: `Moderation: ${business.name} status updated to ${business.approvalStatus} (Active: ${business.isActive}, Open: ${business.isOpen})`,
    });
  }

  res.json(new ApiResponse(200, { business }, "Business updated by admin"));
});

export const toggleBusinessStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const business = await Business.findById(id);
  if (!business) throw new ApiError(404, "Business not found");

  business.isActive = !business.isActive;
  if (!business.isActive) {
    business.isOpen = false;
  } else {
    business.isOpen = true;
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
        : `Moderation: ${business.name} has been suspended by administration.`,
    });
  }

  res.json(new ApiResponse(200, { business }, `Business is now ${business.isActive ? "active" : "deactivated"}`));
});

export const deleteBusiness = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await businessService.deleteBusiness(id);

  const io = req.app.get("io");
  if (io) {
    io.emit("business:deleted", { businessId: id });
  }

  res.json(new ApiResponse(200, null, "Business permanently deleted"));
});

export const getAllUsers = asyncHandler(async (req, res) => {
  const { search, role, status } = req.query;
  const filter = {};

  if (role && role !== "all") {
    filter.role = role;
  }

  if (search) {
    const regex = { $regex: search, $options: "i" };
    filter.$or = [{ name: regex }, { email: regex }, { phone: regex }];
  }

  const users = await User.find(filter)
    .select("-password")
    .sort({ createdAt: -1 });

  // Map active queues to see which users are presently in queue
  let userQueueMap = new Map();
  try {
    const queues = await mongoose.model("Queue").find({
      "users.0": { $exists: true },
    }).populate("businessId", "name category location");

    for (const q of queues) {
      if (!q.users) continue;
      q.users.forEach((u, index) => {
        const uid = u.userId ? u.userId.toString() : null;
        if (uid && !userQueueMap.has(uid)) {
          userQueueMap.set(uid, {
            tokenNumber: u.tokenNumber,
            position: index + 1,
            status: u.status,
            businessName: q.businessId?.name || "Hub",
            businessCategory: q.businessId?.category || "general",
            businessId: q.businessId?._id,
            joinedAt: u.joinedAt,
          });
        }
      });
    }
  } catch {
    // Continue even if queue collection is uninitialized
  }

  // Aggregate user bookings
  let userStatsMap = new Map();
  try {
    const allBookings = await Booking.find().select("userId status paidAmount extraCharge");
    for (const bk of allBookings) {
      if (!bk.userId) continue;
      const uid = bk.userId.toString();
      if (!userStatsMap.has(uid)) {
        userStatsMap.set(uid, { total: 0, completed: 0, spent: 0 });
      }
      const stat = userStatsMap.get(uid);
      stat.total += 1;
      if (bk.status === "completed") {
        stat.completed += 1;
        stat.spent += (bk.paidAmount || 0) + (bk.extraCharge || 0);
      }
    }
  } catch {
    // Continue
  }

  let enriched = users.map((u) => {
    const uid = u._id.toString();
    const isOnline = isUserOnline(uid);
    const userStats = userStatsMap.get(uid) || { total: 0, completed: 0, spent: 0 };
    return {
      ...u.toObject(),
      isOnline,
      activeQueue: userQueueMap.get(uid) || null,
      bookingCount: userStats.total,
      completedCount: userStats.completed,
      totalSpent: userStats.spent,
    };
  });

  if (status === "online") {
    enriched = enriched.filter((u) => u.isOnline);
  } else if (status === "offline") {
    enriched = enriched.filter((u) => !u.isOnline);
  } else if (status === "in_queue") {
    enriched = enriched.filter((u) => Boolean(u.activeQueue));
  }

  res.json(new ApiResponse(200, {
    users: enriched,
    onlineCount: enriched.filter((u) => u.isOnline).length,
    totalCount: enriched.length,
  }));
});

