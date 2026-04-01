import mongoose from "mongoose";
import Business from "./business.model.js";
import ApiError from "../../../utils/ApiError.js";

export const createBusiness = async (ownerId, data) => {
  const business = await Business.create({ ...data, owner: ownerId });
  return business;
};

export const getAllBusinesses = async () => {
  // Use aggregation to fetch businesses with their current queue length and estimated wait
  const businesses = await Business.aggregate([
    { $match: { isOpen: true, isActive: true } },
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
      },
    },
    {
      $addFields: {
        estimatedWait: {
          $cond: [
            { $gt: ["$queueLength", 0] },
            { $add: ["$totalServiceTime", { $multiply: ["$queueLength", 15] }] },
            0
          ]
        }
      }
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
  return businesses;
};

export const getBusinessById = async (id) => {
  const b = await Business.findById(id).populate("owner", "name avatar");
  if (!b) throw new ApiError(404, "Business not found");
  
  // Also get queue info
  const queue = await mongoose.model("Queue").findOne({ businessId: id });
  const bObj = b.toObject();
  const users = queue?.users || [];
  bObj.queueLength = users.length;
  
  if (users.length > 0) {
    const lastUser = users[users.length - 1];
    const buffer = 15;
    const lastEndTime = new Date(new Date(lastUser.estimatedStartTime).getTime() + (lastUser.serviceTime + buffer) * 60000);
    const waitMins = Math.max(0, Math.round((lastEndTime - new Date()) / 60000));
    bObj.estimatedWait = waitMins;
  } else {
    bObj.estimatedWait = 0;
  }
  
  return bObj;
};

export const getMyBusinesses = async (ownerId) => {
  return await Business.find({ owner: ownerId });
};

export const updateBusiness = async (id, ownerId, data) => {
  const b = await Business.findOne({ _id: id, owner: ownerId });
  if (!b) throw new ApiError(403, "Not your business or not found");

  // Prevent overwriting protected fields
  const { owner, _id, __v, createdAt, updatedAt, isActive, ...safeData } = data;

  // Validate averageServiceTime if provided
  if (safeData.averageServiceTime != null) {
    const t = Number(safeData.averageServiceTime);
    if (!Number.isFinite(t) || t < 1 || t > 120) {
      throw new ApiError(400, "Average service time must be 1-120 minutes");
    }
    safeData.averageServiceTime = t;
  }

  Object.assign(b, safeData);
  return await b.save();
};

export const deleteBusiness = async (id) => {
  const b = await Business.findByIdAndDelete(id);
  if (!b) throw new ApiError(404, "Business not found");
  
  // Clean up related queues and bookings (optional but recommended)
  await mongoose.model("Queue").deleteMany({ businessId: id });
  await mongoose.model("Appointment").deleteMany({ businessId: id });
  
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
