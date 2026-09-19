import Business from "../business/business.model.js";
import Booking from "../../booking/booking.model.js";
import Review from "../review/review.model.js";
import ApiError from "../../../utils/ApiError.js";
import { generateBusinessAIAnalytics } from "../../../ai/gemini.service.js";

export const getBusinessAnalytics = async (businessId, requestingUserId, userRole) => {
  const business = await Business.findById(businessId);
  if (!business) throw new ApiError(404, "Business not found");

  if (userRole !== "admin" && business.owner.toString() !== requestingUserId.toString()) {
    throw new ApiError(403, "Access denied: you can only view analytics for your own business");
  }

  // Calculate stats from bookings
  const [totalBookings, completedBookings, cancelledBookings, reviews] = await Promise.all([
    Booking.countDocuments({ businessId }),
    Booking.find({ businessId, status: "completed" }),
    Booking.countDocuments({ businessId, status: "cancelled" }),
    Review.find({ businessId }).sort({ createdAt: -1 }).limit(10),
  ]);

  const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.paidAmount || 0) + (b.extraCharge || 0), 0);
  const avgRating = reviews.length > 0
    ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
    : 5.0;

  const aiInsights = await generateBusinessAIAnalytics({
    businessName: business.name,
    category: business.category,
    bookingsCount: totalBookings,
    cancellationCount: cancelledBookings,
    averageRating: avgRating,
    recentReviews: reviews,
  });

  return {
    businessId,
    businessName: business.name,
    metrics: {
      totalBookings,
      completedBookings: completedBookings.length,
      cancelledBookings,
      totalRevenue,
      customerCount: new Set(completedBookings.map((b) => b.userId?.toString())).size,
      averageRating: avgRating,
      reviewCount: reviews.length,
    },
    aiInsights,
  };
};
