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
    // Only published/completed businesses are discoverable to customers
    match["onboarding.status"] = { $ne: "IN_PROGRESS" };
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

// ─── MULTI-STEP ONBOARDING ENGINE ──────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+0-9\s\-()]{7,20}$/;

export const getOnboardingDraft = async (ownerId, businessId = null) => {
  if (businessId) {
    const biz = await Business.findOne({ _id: businessId, owner: ownerId });
    if (!biz) throw new ApiError(404, "Business draft not found or unauthorized");
    return biz;
  }

  // Find the active in-progress onboarding business for this owner
  let draft = await Business.findOne({
    owner: ownerId,
    "onboarding.status": "IN_PROGRESS",
  }).sort({ updatedAt: -1 });

  return draft;
};

export const initOnboarding = async (ownerId, data = {}) => {
  // If the owner already has an in-progress business draft, return it unless forced
  if (!data.createNew) {
    const existing = await Business.findOne({
      owner: ownerId,
      "onboarding.status": "IN_PROGRESS",
    }).sort({ updatedAt: -1 });

    if (existing) {
      return existing;
    }
  }

  const defaultCategory = data.category || "salon";
  const isClinic = defaultCategory === "clinic" || defaultCategory === "healthcare";

  const defaultSchedule = [
    { day: "monday", isOpen: true, open: "09:00", close: "20:00" },
    { day: "tuesday", isOpen: true, open: "09:00", close: "20:00" },
    { day: "wednesday", isOpen: true, open: "09:00", close: "20:00" },
    { day: "thursday", isOpen: true, open: "09:00", close: "20:00" },
    { day: "friday", isOpen: true, open: "09:00", close: "20:00" },
    { day: "saturday", isOpen: true, open: "10:00", close: "19:00" },
    { day: "sunday", isOpen: false, open: "10:00", close: "18:00" },
  ];

  const defaultServices = isClinic
    ? [
        { name: "General Physician Consultation", duration: 15, price: 400, description: "Primary care checkup", category: "clinic", isAvailable: true, assignedStaff: [] },
        { name: "Specialist Health Review", duration: 30, price: 800, description: "Detailed clinical consult", category: "clinic", isAvailable: true, assignedStaff: [] },
      ]
    : [
        { name: "Haircut & Styling", duration: 30, price: 250, description: "Precision scissor & clipper cut", category: "salon", isAvailable: true, assignedStaff: [] },
        { name: "Beard Grooming & Trim", duration: 15, price: 150, description: "Hot towel & shape lineup", category: "salon", isAvailable: true, assignedStaff: [] },
      ];

  const defaultStaff = isClinic
    ? [
        { name: "Dr. Sarah Jenkins", role: "Senior Consultant", specialties: "General Medicine & Family Health", isAvailable: true, customersServed: 0, rating: 5.0 },
      ]
    : [
        { name: "Alex Rivera", role: "Master Stylist", specialties: "Fade, Lineup & Scissor Craft", isAvailable: true, customersServed: 0, rating: 5.0 },
      ];

  const newBiz = await Business.create({
    name: data.name ? String(data.name).trim() : "My New Business Hub",
    category: defaultCategory,
    description: data.description || "",
    email: data.email || "",
    phone: data.phone || "",
    owner: ownerId,
    address: data.address || "",
    location: data.location || "",
    locationDetails: {
      country: data.country || "India",
      state: data.state || "",
      city: data.city || "",
      postalCode: data.postalCode || "",
    },
    operatingHours: {
      timezone: data.timezone || "Asia/Kolkata",
      weeklySchedule: defaultSchedule,
      weeklyHolidays: ["sunday"],
    },
    timings: { open: "09:00", close: "20:00" },
    services: defaultServices,
    serviceTypes: defaultServices.map((s) => s.name),
    staff: defaultStaff,
    bookingSettings: {
      enableAppointments: true,
      allowStaffSelection: true,
      allowSameDayBooking: true,
      maxAdvanceBookingDays: 14,
      cancellationWindowHours: 2,
      bufferTimeBetweenAppointments: 15,
    },
    queueSettings: {
      enableLiveQueue: true,
      allowWalkIns: true,
      queueOpeningTime: "09:00",
      queueClosingTime: "20:00",
      maxQueueCapacity: 30,
    },
    paymentConfiguration: {
      paymentMode: "PAY_AT_BUSINESS",
      onlinePaymentStatus: "NOT_STARTED",
      paymentProvider: "mock",
      providerAccountReference: "",
      upiId: "",
      lastVerificationUpdate: null,
    },
    onboarding: {
      currentStep: 1,
      completedSteps: [],
      status: "IN_PROGRESS",
      startedAt: new Date(),
      completedAt: null,
    },
    isActive: false, // Inactive until launched
    isOpen: false,
    approvalStatus: "approved",
  });

  // Initialize associated Queue if DB is connected
  if (mongoose.connection?.readyState === 1) {
    const Queue = mongoose.model("Queue");
    const existingQueue = await Queue.findOne({ businessId: newBiz._id });
    if (!existingQueue) {
      await Queue.create({ businessId: newBiz._id, users: [] });
    }
  }

  return newBiz;
};

export const saveOnboardingStep = async (id, ownerId, stepNumber, stepData) => {
  const b = await Business.findOne({ _id: id, owner: ownerId });
  if (!b) throw new ApiError(404, "Business not found or unauthorized");

  const step = Number(stepNumber);
  if (![1, 2, 3, 4, 5, 6].includes(step)) {
    throw new ApiError(400, "Invalid onboarding step number (1 to 6)");
  }

  // Ensure onboarding structure exists
  if (!b.onboarding) {
    b.onboarding = {
      currentStep: 1,
      completedSteps: [],
      status: "IN_PROGRESS",
      startedAt: new Date(),
      completedAt: null,
    };
  }

  switch (step) {
    // ── STEP 1: BUSINESS INFORMATION ──
    case 1: {
      if (!stepData.name || !String(stepData.name).trim()) {
        throw new ApiError(400, "Business name cannot be empty");
      }
      b.name = String(stepData.name).trim();

      if (stepData.category) {
        const allowed = ["salon", "clinic", "healthcare", "other"];
        if (!allowed.includes(stepData.category)) {
          throw new ApiError(400, `Category must be one of: ${allowed.join(", ")}`);
        }
        b.category = stepData.category;
      }

      if (stepData.description !== undefined) {
        b.description = String(stepData.description || "").trim();
      }

      if (stepData.email) {
        const emailTrim = String(stepData.email).trim().toLowerCase();
        if (!EMAIL_REGEX.test(emailTrim)) {
          throw new ApiError(400, "Please provide a valid business email address");
        }
        b.email = emailTrim;
      }

      if (stepData.phone) {
        const phoneTrim = String(stepData.phone).trim();
        if (!PHONE_REGEX.test(phoneTrim)) {
          throw new ApiError(400, "Please provide a valid phone number format");
        }
        b.phone = phoneTrim;
      }

      if (stepData.logo !== undefined) {
        b.logo = String(stepData.logo || "").trim();
      }
      if (stepData.coverImage !== undefined) {
        b.coverImage = String(stepData.coverImage || "").trim();
      }
      break;
    }

    // ── STEP 2: LOCATION & OPERATING HOURS ──
    case 2: {
      if (!stepData.address && !stepData.location && !stepData.city) {
        throw new ApiError(400, "Please provide a street address or city for your venue location");
      }

      b.address = String(stepData.address || b.address || "").trim();
      b.location = String(stepData.location || b.location || stepData.city || "").trim();

      b.locationDetails = {
        country: String(stepData.country || b.locationDetails?.country || "India").trim(),
        state: String(stepData.state || b.locationDetails?.state || "").trim(),
        city: String(stepData.city || b.locationDetails?.city || "").trim(),
        postalCode: String(stepData.postalCode || b.locationDetails?.postalCode || "").trim(),
      };

      if (stepData.coordinates) {
        b.coordinates = {
          lat: Number(stepData.coordinates.lat) || 0,
          lng: Number(stepData.coordinates.lng) || 0,
        };
      }

      // Operating Hours Validation
      if (stepData.operatingHours || stepData.weeklySchedule) {
        const schedule = stepData.operatingHours?.weeklySchedule || stepData.weeklySchedule;
        if (Array.isArray(schedule)) {
          for (const s of schedule) {
            if (s.isOpen && s.open && s.close) {
              if (s.open >= s.close) {
                throw new ApiError(
                  400,
                  `Closing time (${s.close}) must be after opening time (${s.open}) for ${s.day || "the schedule"}`
                );
              }
            }
          }
          b.operatingHours = {
            timezone: stepData.operatingHours?.timezone || stepData.timezone || b.operatingHours?.timezone || "Asia/Kolkata",
            weeklySchedule: schedule.map((s) => ({
              day: String(s.day || "").toLowerCase(),
              isOpen: s.isOpen !== false,
              open: String(s.open || "09:00"),
              close: String(s.close || "20:00"),
            })),
            weeklyHolidays: Array.isArray(stepData.operatingHours?.weeklyHolidays)
              ? stepData.operatingHours.weeklyHolidays
              : (stepData.weeklyHolidays || []),
          };

          // Sync default timings with first open day
          const firstOpen = schedule.find((s) => s.isOpen !== false);
          if (firstOpen) {
            b.timings = { open: firstOpen.open, close: firstOpen.close };
          }
        }
      }
      break;
    }

    // ── STEP 3: SERVICES CONFIGURATION ──
    case 3: {
      if (!Array.isArray(stepData.services) || stepData.services.length === 0) {
        throw new ApiError(400, "Your business must have at least one service configured");
      }

      const sanitizedServices = stepData.services
        .map((s) => ({
          name: String(s.name || "").trim(),
          duration: Math.max(1, Number(s.duration) || 15),
          price: Math.max(0, Number(s.price) || 0),
          description: String(s.description || "").trim(),
          category: String(s.category || b.category || "").trim(),
          isAvailable: s.isAvailable !== false,
          assignedStaff: Array.isArray(s.assignedStaff) ? s.assignedStaff.map(String) : [],
        }))
        .filter((s) => s.name.length > 0);

      if (sanitizedServices.length === 0) {
        throw new ApiError(400, "At least one service with a valid name is required");
      }

      b.services = sanitizedServices;
      b.serviceTypes = sanitizedServices.map((s) => s.name);
      if (sanitizedServices[0]) {
        b.averageServiceTime = sanitizedServices[0].duration;
        b.basePrice = sanitizedServices[0].price;
      }
      break;
    }

    // ── STEP 4: STAFF CONFIGURATION ──
    case 4: {
      if (Array.isArray(stepData.staff)) {
        b.staff = stepData.staff
          .map((st) => ({
            name: String(st.name || "").trim(),
            role: String(st.role || "").trim(),
            specialties: String(st.specialties || "").trim(),
            phone: String(st.phone || "").trim(),
            profileImage: String(st.profileImage || "").trim(),
            description: String(st.description || "").trim(),
            assignedServices: Array.isArray(st.assignedServices) ? st.assignedServices.map(String) : [],
            isAvailable: st.isAvailable !== false,
            workingHours: {
              open: st.workingHours?.open || "09:00",
              close: st.workingHours?.close || "19:00",
            },
            customersServed: Math.max(0, Number(st.customersServed) || 0),
            rating: Math.max(1, Math.min(5, Number(st.rating) || 5.0)),
          }))
          .filter((st) => st.name.length > 0);
      }
      break;
    }

    // ── STEP 5: BOOKING & QUEUE PREFERENCES ──
    case 5: {
      b.bookingSettings = {
        enableAppointments: stepData.bookingSettings?.enableAppointments !== false,
        allowStaffSelection: stepData.bookingSettings?.allowStaffSelection !== false,
        allowSameDayBooking: stepData.bookingSettings?.allowSameDayBooking !== false,
        maxAdvanceBookingDays: Math.max(1, Math.min(90, Number(stepData.bookingSettings?.maxAdvanceBookingDays) || 14)),
        cancellationWindowHours: Math.max(0, Math.min(72, Number(stepData.bookingSettings?.cancellationWindowHours) || 2)),
        bufferTimeBetweenAppointments: Math.max(0, Math.min(60, Number(stepData.bookingSettings?.bufferTimeBetweenAppointments) || 15)),
      };

      b.queueSettings = {
        enableLiveQueue: stepData.queueSettings?.enableLiveQueue !== false,
        allowWalkIns: stepData.queueSettings?.allowWalkIns !== false,
        queueOpeningTime: String(stepData.queueSettings?.queueOpeningTime || "09:00"),
        queueClosingTime: String(stepData.queueSettings?.queueClosingTime || "20:00"),
        maxQueueCapacity: Math.max(5, Math.min(200, Number(stepData.queueSettings?.maxQueueCapacity) || 30)),
      };
      break;
    }

    // ── STEP 6: PAYMENT CONFIGURATION ──
    case 6: {
      const allowedModes = ["PAY_AT_BUSINESS", "ONLINE", "BOTH"];
      const mode = allowedModes.includes(stepData.paymentMode) ? stepData.paymentMode : "PAY_AT_BUSINESS";

      const allowedStatuses = ["NOT_STARTED", "PENDING_VERIFICATION", "ACTIVE", "REJECTED", "SUSPENDED"];
      const status = allowedStatuses.includes(stepData.onlinePaymentStatus)
        ? stepData.onlinePaymentStatus
        : (mode === "PAY_AT_BUSINESS" ? "NOT_STARTED" : "PENDING_VERIFICATION");

      b.paymentConfiguration = {
        paymentMode: mode,
        onlinePaymentStatus: status,
        paymentProvider: String(stepData.paymentProvider || "mock").trim(),
        providerAccountReference: String(stepData.providerAccountReference || "").trim(),
        upiId: String(stepData.upiId || "").trim(),
        lastVerificationUpdate: new Date(),
      };
      break;
    }
  }

  // Update onboarding state
  const completedSet = new Set(b.onboarding.completedSteps || []);
  completedSet.add(step);
  b.onboarding.completedSteps = Array.from(completedSet).sort((x, y) => x - y);
  b.onboarding.currentStep = Math.min(7, Math.max(b.onboarding.currentStep, step + 1));

  await b.save();
  return b;
};

export const launchBusiness = async (id, ownerId, io = null) => {
  const b = await Business.findOne({ _id: id, owner: ownerId });
  if (!b) throw new ApiError(404, "Business not found or unauthorized");

  if (b.onboarding?.status === "COMPLETED") {
    return b; // Idempotent
  }

  // Comprehensive server-side pre-flight validations
  if (!b.name || b.name.trim().length < 2) {
    throw new ApiError(400, "Launch failed: Business must have a valid name");
  }
  if (!b.address && !b.location && !b.locationDetails?.city) {
    throw new ApiError(400, "Launch failed: Business must have an address or city configured");
  }
  if (!Array.isArray(b.services) || b.services.length === 0) {
    throw new ApiError(400, "Launch failed: Business must have at least one active service configured");
  }
  if (!b.paymentConfiguration?.paymentMode) {
    b.paymentConfiguration = {
      paymentMode: "PAY_AT_BUSINESS",
      onlinePaymentStatus: "NOT_STARTED",
      paymentProvider: "mock",
      providerAccountReference: "",
      upiId: "",
      lastVerificationUpdate: new Date(),
    };
  }

  // Complete onboarding and publish business
  b.onboarding.status = "COMPLETED";
  b.onboarding.completedAt = new Date();
  b.onboarding.completedSteps = [1, 2, 3, 4, 5, 6, 7];
  b.onboarding.currentStep = 7;
  b.isActive = true;
  b.isOpen = true;

  await b.save();

  // Ensure Queue document exists if DB is connected
  if (mongoose.connection?.readyState === 1) {
    const Queue = mongoose.model("Queue");
    const existingQueue = await Queue.findOne({ businessId: b._id });
    if (!existingQueue) {
      await Queue.create({ businessId: b._id, users: [] });
    }
  }

  if (io) {
    io.emit("business:created", { businessId: b._id, business: b });
  }

  return b;
};
