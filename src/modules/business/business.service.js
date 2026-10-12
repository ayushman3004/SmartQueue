import mongoose from "mongoose";
import Business from "./business.model.js";
import Booking from "../../booking/booking.model.js";
import ApiError from "../../../utils/ApiError.js";

export const createBusiness = async (ownerId, data) => {
  const payload = { ...data, owner: ownerId };
  if (Array.isArray(payload.services) && payload.services.length > 0) {
    payload.services = payload.services
      .map(s => ({
        name: String(s.name || '').trim(),
        duration: Math.max(1, Number(s.duration) || 10),
        price: Math.max(0, Number(s.price) || 0),
      }))
      .filter(s => s.name);
    payload.serviceTypes = payload.services.map(s => s.name);
  } else if (!payload.services || payload.services.length === 0) {
    payload.services = [{ name: "General Service", duration: payload.averageServiceTime || 15, price: payload.basePrice || 0 }];
    payload.serviceTypes = ["General Service"];
  }

  // Initialize default staff (Barbers for salons, Doctors for clinics) if not provided
  if (!Array.isArray(payload.staff) || payload.staff.length === 0) {
    const isClinic = payload.category === "clinic" || payload.category === "healthcare";
    payload.staff = isClinic
      ? [
          { name: "Dr. Sarah Jenkins", role: "Senior Consultant", specialties: "General Medicine & Family Care", isAvailable: true, customersServed: 28, rating: 4.9 },
          { name: "Dr. Rajesh Gupta", role: "Specialist Physician", specialties: "Internal Medicine & Diagnostics", isAvailable: true, customersServed: 24, rating: 5.0 },
        ]
      : [
          { name: "Alex Rivera", role: "Master Barber", specialties: "Fade, Lineup & Beard Design", isAvailable: true, customersServed: 32, rating: 4.9 },
          { name: "David Chen", role: "Senior Stylist", specialties: "Scissor Cut & Texture Styling", isAvailable: true, customersServed: 21, rating: 4.8 },
        ];
  }

  const business = await Business.create(payload);

  // Initialize a Queue document for the new business
  const Queue = mongoose.model("Queue");
  const existingQueue = await Queue.findOne({ businessId: business._id });
  if (!existingQueue) {
    await Queue.create({ businessId: business._id, users: [] });
  }

  return business;
};

export const getAllBusinesses = async (filters = {}) => {
  const match = {};

  if (!filters.includeAll) {
    match.isActive = true;
    if (filters.onlyOpen !== false) {
      match.isOpen = true;
    }
  }

  if (filters.category && filters.category !== "all") {
    if (filters.category === "clinic" || filters.category === "healthcare") {
      match.category = { $in: ["clinic", "healthcare"] };
    } else {
      match.category = filters.category;
    }
  }

  if (filters.location) {
    match.$or = [
      { location: { $regex: filters.location, $options: "i" } },
      { address: { $regex: filters.location, $options: "i" } },
    ];
  }

  if (filters.search) {
    const searchRegex = { $regex: filters.search, $options: "i" };
    match.$or = [
      { name: searchRegex },
      { description: searchRegex },
      { category: searchRegex },
      { location: searchRegex },
      { address: searchRegex },
    ];
  }

  const businesses = await Business.aggregate([
    { $match: match },
    {
      $lookup: {
        from: "queues",
        localField: "_id",
        foreignField: "businessId",
        as: "queue",
      },
    },
    {
      $addFields: {
        queueData: { $arrayElemAt: ["$queue", 0] },
      },
    },
    {
      $addFields: {
        queueLength: { $size: { $ifNull: ["$queueData.users", []] } },
        totalServiceTime: { $sum: "$queueData.users.serviceTime" },
        activeQueue: { $ifNull: ["$queueData.users", []] },
      },
    },
    {
      $addFields: {
        estimatedWait: {
          $cond: [
            { $gt: ["$queueLength", 0] },
            { $add: ["$totalServiceTime", { $multiply: ["$queueLength", 15] }] },
            0,
          ],
        },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
      },
    },
    {
      $addFields: {
        owner: { $arrayElemAt: ["$owner", 0] },
      },
    },
    {
      $project: {
        queue: 0,
        queueData: 0,
        "owner.password": 0,
        "owner.__v": 0,
      },
    },
  ]);

  await enrichStaffAvailability(businesses);
  return businesses;
};

// Enrich staff availability with live queue and active appointments
export const enrichStaffAvailability = async (businesses) => {
  if (!businesses) return businesses;
  const isArray = Array.isArray(businesses);
  const list = isArray ? businesses : [businesses];
  if (list.length === 0) return businesses;

  const bizIds = list.map((b) => b._id).filter(Boolean);
  const now = new Date();

  let activeBookings = [];
  try {
    if (Booking && bizIds.length > 0 && (mongoose.connection?.readyState === 1 || Booking.find !== mongoose.Model.find)) {
      activeBookings = await Booking.find({
        businessId: { $in: bizIds },
        status: { $in: ["confirmed", "serving"] },
        startTime: { $lte: now },
        endTime: { $gte: now },
      }).select("businessId assignedStaff serviceType startTime endTime");
    }
  } catch {
    // Non-critical fallback
  }

  for (const b of list) {
    const queueUsers = b.activeQueue || [];
    const servingQueueUsers = queueUsers.filter((u) => u.status === "serving" && u.assignedStaff?.name);

    const busyStaffMap = new Map();
    servingQueueUsers.forEach((u) => {
      busyStaffMap.set(u.assignedStaff.name.toLowerCase(), {
        serviceType: u.serviceType,
        source: "queue",
      });
    });

    const bBookings = activeBookings.filter(
      (bk) => bk.businessId?.toString() === b._id?.toString() && bk.assignedStaff?.name
    );
    bBookings.forEach((bk) => {
      busyStaffMap.set(bk.assignedStaff.name.toLowerCase(), {
        serviceType: bk.serviceType,
        source: "booking",
      });
    });

    if (Array.isArray(b.staff)) {
      b.staff = b.staff.map((st) => {
        const busyInfo = busyStaffMap.get(st.name.toLowerCase());
        const isOccupied = Boolean(busyInfo);
        const stObj = typeof st.toObject === "function" ? st.toObject() : st;
        return {
          ...stObj,
          isOccupied,
          currentService: busyInfo ? busyInfo.serviceType : null,
          effectiveAvailable: (st.isAvailable !== false) && !isOccupied,
        };
      });
    }
  }

  return isArray ? list : list[0];
};

export const getBusinessById = async (id) => {
  const b = await Business.findById(id).populate("owner", "name avatar");
  if (!b) throw new ApiError(404, "Business not found");

  const queue = await mongoose.model("Queue").findOne({ businessId: id });
  const bObj = b.toObject();
  const users = queue?.users || [];
  bObj.queueLength = users.length;
  bObj.activeQueue = users;

  if (users.length > 0) {
    const lastUser = users[users.length - 1];
    const buffer = 15;
    const lastEndTime = new Date(new Date(lastUser.estimatedStartTime).getTime() + (lastUser.serviceTime + buffer) * 60000);
    const waitMins = Math.max(0, Math.round((lastEndTime - new Date()) / 60000));
    bObj.estimatedWait = waitMins;
  } else {
    bObj.estimatedWait = 0;
  }

  await enrichStaffAvailability(bObj);
  return bObj;
};

export const getMyBusinesses = async (ownerId) => {
  return await Business.find({ owner: ownerId });
};

export const updateBusiness = async (id, ownerId, data, userRole = null) => {
  const query = userRole === "admin" ? { _id: id } : { _id: id, owner: ownerId };
  const b = await Business.findOne(query);
  if (!b) throw new ApiError(403, "Not your business or not found");

  // Prevent overwriting protected fields
  const { owner: _owner, _id: _idField, __v: _version, createdAt: _createdAt, updatedAt: _updatedAt, ...safeData } = data;

  if (userRole !== "admin") {
    delete safeData.isActive;
    delete safeData.approvalStatus;
  }

  // Validate averageServiceTime if provided
  if (safeData.averageServiceTime != null) {
    const t = Number(safeData.averageServiceTime);
    if (!Number.isFinite(t) || t < 1 || t > 120) {
      throw new ApiError(400, "Average service time must be 1-120 minutes");
    }
    safeData.averageServiceTime = t;
  }

  // Validate and sync services if provided
  if (Array.isArray(safeData.services)) {
    safeData.services = safeData.services
      .map(s => ({
        name: String(s.name || '').trim(),
        duration: Math.max(1, Number(s.duration) || 10),
        price: Math.max(0, Number(s.price) || 0),
      }))
      .filter(s => s.name);
    safeData.serviceTypes = safeData.services.map(s => s.name);
  }

  // Validate and sanitize staff if provided
  if (Array.isArray(safeData.staff)) {
    safeData.staff = safeData.staff
      .map(st => ({
        name: String(st.name || '').trim(),
        role: String(st.role || '').trim(),
        specialties: String(st.specialties || '').trim(),
        phone: String(st.phone || '').trim(),
        isAvailable: st.isAvailable !== false,
        customersServed: Math.max(0, Number(st.customersServed) || 0),
        rating: Math.max(1, Math.min(5, Number(st.rating) || 5.0)),
      }))
      .filter(st => st.name);
  }

  Object.assign(b, safeData);
  return await b.save();
};

export const deleteBusiness = async (id) => {
  const b = await Business.findByIdAndDelete(id);
  if (!b) throw new ApiError(404, "Business not found");
  
  // Clean up related queues and bookings
  await mongoose.model("Queue").deleteMany({ businessId: id });
  await mongoose.model("Booking").deleteMany({ businessId: id });
  
  return b;
};

export const toggleOpen = async (id, ownerId, io) => {
  const b = await Business.findOne({ _id: id, owner: ownerId });
  if (!b) throw new ApiError(403, "Not your business or not found");
  
  if (!b.isActive) {
    throw new ApiError(403, "Access Revoked. Your business has been deactivated by administration.");
  }
  
  b.isOpen = !b.isOpen;
  await b.save();

  if (io) {
    io.emit("business:status", {
      businessId: id,
      isOpen: b.isOpen,
      name: b.name,
      category: b.category,
      message: b.isOpen ? `Welcome! ${b.name} is now open.` : `Note: ${b.name} has closed for now.`
    });
  }

  return b;
};
