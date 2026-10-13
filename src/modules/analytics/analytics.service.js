import mongoose from "mongoose";
import Business from "../business/business.model.js";
import Booking from "../../booking/booking.model.js";
import Review from "../review/review.model.js";
import Queue from "../../queue/queue.model.js";
import ApiError from "../../../utils/ApiError.js";
import { generateBusinessAIAnalytics } from "../../../ai/gemini.service.js";

export const getBusinessAnalytics = async (businessId, requestingUserId, userRole, options = {}) => {
  const business = await Business.findById(businessId);
  if (!business) throw new ApiError(404, "Business not found");

  if (userRole !== "admin" && business.owner.toString() !== requestingUserId.toString()) {
    throw new ApiError(403, "Access denied: you can only view analytics for your own business");
  }

  // Fetch bookings, reviews, and active queue
  const [totalBookings, allBookings, reviews] = await Promise.all([
    Booking.countDocuments({ businessId }),
    Booking.find({ businessId }).populate("userId", "name email phone").sort({ createdAt: -1 }),
    Review.find({ businessId }).sort({ createdAt: -1 }).limit(10),
  ]);

  // Safely check active live queue users if database is connected
  let liveQueueUsers = [];
  try {
    if (Queue && mongoose.connection.readyState === 1) {
      const qDoc = await Queue.findOne({ businessId }).populate("users.userId", "name email phone");
      if (qDoc && Array.isArray(qDoc.users)) {
        liveQueueUsers = qDoc.users.filter(
          (u) => u.status === "waiting" || u.status === "serving"
        );
      }
    }
  } catch {
    // Non-critical fallback
  }

  const liveQueueRevenue = liveQueueUsers.reduce((sum, u) => {
    const svcPrice = (u.services || []).reduce((sSum, s) => sSum + (Number(s.price) || 0), 0) || business.basePrice || u.paidAmount || 0;
    return sum + Math.max(Number(u.paidAmount) || 0, Number(svcPrice) || 0);
  }, 0);

  // Separate earned (active/completed) vs cancelled bookings
  const earnedBookings = allBookings.filter(
    (b) => b.status !== "cancelled" && b.status !== "refunded"
  );
  const completedBookings = allBookings.filter((b) => b.status === "completed");
  const activeBookings = earnedBookings.filter((b) => b.status !== "completed");

  const cancelledBookingsList = allBookings.filter(
    (b) => b.status === "cancelled" || b.status === "refunded"
  );
  const cancelledBookingsCount = cancelledBookingsList.length;

  const totalRevenue = earnedBookings.reduce(
    (sum, b) => sum + (b.paidAmount || 0) + (b.extraCharge || 0),
    0
  ) + liveQueueRevenue;
  const completedRevenue = completedBookings.reduce(
    (sum, b) => sum + (b.paidAmount || 0) + (b.extraCharge || 0),
    0
  );
  const cancelledRevenue = cancelledBookingsList.reduce(
    (sum, b) => sum + (b.paidAmount || 0) + (b.extraCharge || 0),
    0
  );

  const avgRating =
    reviews.length > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
      : 5.0;

  // ─── 1. Calculate Daily Customer Breakdown (Rolling Past 7 Days + All Booked Dates) ───
  const daysMap = new Map();
  const today = new Date();

  const getDateKey = (dateObj) => {
    const d = new Date(dateObj);
    return d.toISOString().split("T")[0];
  };

  const getDisplayDate = (dateObj) => {
    const d = new Date(dateObj);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const createDayEntry = (dateKey, displayDate) => ({
    date: dateKey,
    displayDate,
    totalBookings: 0,
    totalCustomers: 0,
    activeCount: 0,
    completedCount: 0,
    cancelledCount: 0,
    revenue: 0,
    cancelledRevenue: 0,
    services: {},
  });

  // Initialize the last 7 days with zero defaults up to today
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateKey = getDateKey(d);
    daysMap.set(dateKey, createDayEntry(dateKey, getDisplayDate(d)));
  }

  // Ensure any date from allBookings (scheduled startTime or createdAt) has a bin
  allBookings.forEach((b) => {
    const targetDate = b.startTime || b.createdAt;
    if (targetDate) {
      const dateKey = getDateKey(targetDate);
      if (!daysMap.has(dateKey)) {
        daysMap.set(dateKey, createDayEntry(dateKey, getDisplayDate(targetDate)));
      }
    }
  });

  // Aggregate bookings into daily bins
  allBookings.forEach((b) => {
    const targetDate = b.startTime || b.createdAt;
    if (!targetDate) return;
    const dateKey = getDateKey(targetDate);
    const entry = daysMap.get(dateKey);
    if (!entry) return;

    entry.totalBookings += 1;
    entry.totalCustomers += 1;

    const isCancelled = b.status === "cancelled" || b.status === "refunded";
    const amount = (b.paidAmount || 0) + (b.extraCharge || 0);

    if (isCancelled) {
      entry.cancelledCount += 1;
      entry.cancelledRevenue += amount;
    } else {
      entry.revenue += amount;
      if (b.status === "completed") {
        entry.completedCount += 1;
      } else {
        entry.activeCount += 1;
      }
    }

    if (b.serviceType) {
      entry.services[b.serviceType] = (entry.services[b.serviceType] || 0) + 1;
    }
  });

  // Sort daily breakdown chronologically
  const dailyBreakdown = Array.from(daysMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => {
      let topService = "General Service";
      let maxCount = 0;
      Object.entries(day.services).forEach(([svc, count]) => {
        if (count > maxCount) {
          maxCount = count;
          topService = svc;
        }
      });

      return {
        date: day.date,
        displayDate: day.displayDate,
        totalBookings: day.totalBookings,
        totalCustomers: day.totalCustomers,
        activeCount: day.activeCount,
        completedCount: day.completedCount,
        cancelledCount: day.cancelledCount,
        revenue: day.revenue,
        cancelledRevenue: day.cancelledRevenue,
        topService,
      };
    });

  // ─── 2. Identify Top / Best Customer ────────────────────────────────────────
  const customerMap = new Map();
  earnedBookings.forEach((b) => {
    const uId = b.userId?._id?.toString() || b.userId?.toString();
    if (!uId) return;
    if (!customerMap.has(uId)) {
      customerMap.set(uId, {
        userId: uId,
        name: b.userId?.name || "Verified Customer",
        email: b.userId?.email || "",
        visits: 0,
        totalSpent: 0,
      });
    }
    const cData = customerMap.get(uId);
    cData.visits += 1;
    cData.totalSpent += (b.paidAmount || 0) + (b.extraCharge || 0);
  });

  let topCustomer = null;
  customerMap.forEach((c) => {
    if (
      !topCustomer ||
      c.visits > topCustomer.visits ||
      (c.visits === topCustomer.visits && c.totalSpent > topCustomer.totalSpent)
    ) {
      topCustomer = c;
    }
  });

  // ─── 3. Identify Top Employee (Barber or Doctor) ───────────────────────────
  const staffList = Array.isArray(business.staff) ? business.staff : [];
  let topEmployee = null;
  if (staffList.length > 0) {
    topEmployee = staffList.reduce((best, cur) => {
      if (!best) return cur;
      return (cur.customersServed || 0) > (best.customersServed || 0) ? cur : best;
    }, null);
  }

  // ─── 4. Generate AI Executive Analytics ────────────────────────────────────
  const aiInsights = await generateBusinessAIAnalytics({
    businessName: business.name,
    category: business.category,
    bookingsCount: totalBookings,
    cancellationCount: cancelledBookingsCount,
    averageRating: avgRating,
    recentReviews: reviews,
    topCustomer,
    topEmployee,
    staffList,
  });

  const uniqueCustomerIds = new Set([
    ...earnedBookings
      .map((b) => b.userId?._id?.toString() || b.userId?.toString())
      .filter(Boolean),
    ...liveQueueUsers
      .map((u) => u.userId?._id?.toString() || u.userId?.toString())
      .filter(Boolean),
  ]);

  return {
    businessId,
    businessName: business.name,
    category: business.category,
    staff: staffList,
    dailyBreakdown,
    metrics: {
      totalBookings: totalBookings + liveQueueUsers.length,
      activeBookings: activeBookings.length + liveQueueUsers.length,
      completedBookings: completedBookings.length,
      cancelledBookings: cancelledBookingsCount,
      totalRevenue,
      completedRevenue,
      cancelledRevenue,
      customerCount: uniqueCustomerIds.size,
      averageRating: avgRating,
      reviewCount: reviews.length,
      dailyAverage:
        Math.round(
          (dailyBreakdown.reduce((sum, d) => sum + d.totalCustomers, 0) /
            (dailyBreakdown.length || 1)) *
            10
        ) / 10,
    },
    topCustomer,
    topEmployee,
    aiInsights,
  };
};
