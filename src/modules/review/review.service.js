import Review from "./review.model.js";
import Booking from "../../booking/booking.model.js";
import Business from "../business/business.model.js";
import ApiError from "../../../utils/ApiError.js";

export const createReview = async ({ bookingId, businessId, userId, rating, comment }) => {
  const numRating = Number(rating);
  if (!numRating || numRating < 1 || numRating > 5) {
    throw new ApiError(400, "Rating must be between 1 and 5");
  }

  // Verify business exists
  const business = await Business.findById(businessId);
  if (!business) throw new ApiError(404, "Business not found");

  let booking = null;
  // If bookingId provided, verify it belongs to user and is completed
  if (bookingId) {
    booking = await Booking.findOne({ _id: bookingId, userId });
    if (!booking) {
      throw new ApiError(403, "You can only review bookings that belong to you");
    }
    const existing = await Review.findOne({ bookingId });
    if (existing) {
      throw new ApiError(409, "You have already submitted a review for this booking");
    }
  }

  const review = await Review.create({
    bookingId,
    businessId,
    userId,
    rating: Math.round(numRating),
    comment: comment || "",
  });

  await refreshBusinessRating(business, businessId, booking);

  return await review.populate("userId", "name avatar");
};

export const updateReview = async ({ reviewId, userId, rating, comment }) => {
  const numRating = Number(rating);
  if (!numRating || numRating < 1 || numRating > 5) {
    throw new ApiError(400, "Rating must be between 1 and 5");
  }
  const review = await Review.findOne({ _id: reviewId, userId });
  if (!review) throw new ApiError(404, "Review not found");
  const business = await Business.findById(review.businessId);
  if (!business) throw new ApiError(404, "Business not found");
  const booking = review.bookingId
    ? await Booking.findOne({ _id: review.bookingId, userId }) : null;

  review.rating = Math.round(numRating);
  review.comment = comment || "";
  await review.save();
  await refreshBusinessRating(business, review.businessId, booking);
  return await review.populate("userId", "name avatar");
};

const refreshBusinessRating = async (business, businessId, booking) => {
  const allReviews = await Review.find({ businessId });
  const total = allReviews.length;
  const avg = Math.round((allReviews.reduce((sum, r) => sum + r.rating, 0) / total) * 10) / 10;
  business.rating = avg;
  business.averageRating = avg;
  business.totalReviews = total;
  business.reviewCount = total;

  if (booking?.assignedStaff?.name && Array.isArray(business.staff)) {
    const staffMember = business.staff.find(
      (s) => s.name?.toLowerCase() === booking.assignedStaff.name.toLowerCase()
    );
    if (staffMember) {
      staffMember.rating = avg;
    }
  }

  await business.save();

};

export const getBusinessReviews = async (businessId) => {
  const reviews = await Review.find({ businessId })
    .populate("userId", "name avatar")
    .sort({ createdAt: -1 });

  const total = reviews.length;
  const avgRating = total > 0
    ? Math.round((reviews.reduce((acc, r) => acc + r.rating, 0) / total) * 10) / 10
    : 0;

  return { reviews, total, avgRating };
};

export const getMyReviews = async (userId) => {
  return await Review.find({ userId })
    .populate("businessId", "name category")
    .sort({ createdAt: -1 });
};
