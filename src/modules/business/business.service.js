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
        estimatedWait: {
          $multiply: [
            { $size: { $ifNull: ["$queueData.users", []] } },
            "$averageServiceTime",
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
  return businesses;
};

export const getBusinessById = async (id) => {
  const b = await Business.findById(id).populate("owner", "name avatar");
  if (!b) throw new ApiError(404, "Business not found");
  
  // Also get queue info
  const queue = await mongoose.model("Queue").findOne({ businessId: id });
  const bObj = b.toObject();
  bObj.queueLength = queue?.users?.length || 0;
  bObj.estimatedWait = (queue?.users?.length || 0) * (b.averageServiceTime || 10);
  
  return bObj;
};

export const getMyBusinesses = async (ownerId) => {
  return await Business.find({ owner: ownerId });
};

export const updateBusiness = async (id, ownerId, data) => {
  const b = await Business.findOne({ _id: id, owner: ownerId });
  if (!b) throw new ApiError(403, "Not your business or not found");

  // Prevent overwriting protected fields
  const { owner, _id, __v, createdAt, updatedAt, ...safeData } = data;

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

export const toggleOpen = async (id, ownerId, io) => {
  const b = await Business.findOne({ _id: id, owner: ownerId });
  if (!b) throw new ApiError(403, "Not your business or not found");
  
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
