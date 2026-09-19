import * as reviewService from "./review.service.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";

export const create = asyncHandler(async (req, res) => {
  const { bookingId, businessId, rating, comment } = req.body;
  const review = await reviewService.createReview({
    bookingId,
    businessId,
    userId: req.user._id,
    rating,
    comment,
  });

  const io = req.app.get("io");
  if (io) {
    io.to(`business:${businessId}`).emit("review:added", { businessId, review });
  }

  res.status(201).json(new ApiResponse(201, { review }, "Review submitted successfully"));
});

export const getByBusiness = asyncHandler(async (req, res) => {
  const result = await reviewService.getBusinessReviews(req.params.businessId);
  res.json(new ApiResponse(200, result));
});

export const getMine = asyncHandler(async (req, res) => {
  const reviews = await reviewService.getMyReviews(req.user._id);
  res.json(new ApiResponse(200, { reviews }));
});
