import { notifyUser } from '../notification/notification.service.js';
import { assertTestVenueAccess } from '../admin/admin-workspace.service.js';
import { queueRowsForViewer } from "../../queue/queue.view.js";

import { canAccessOwnerCategory, resolveOwnerHubCategory } from "../../utils/ownerCategory.js";
import BusinessApplication from "../business-application/business-application.model.js";
import ApiError from "../../../utils/ApiError.js";
import * as businessService from "./business.service.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";

const publicBusiness = (business, viewerId, manage = false) => {
  const value = business.toObject?.() || business;
  const owner = value.owner?._id && typeof value.owner?.toHexString !== "function" ? {
    _id: value.owner._id,
    name: value.owner.name,
    avatar: value.owner.avatar,
    subscription: value.owner.subscription,
    role: value.owner.role,
  } : value.owner;
  return {
    ...value,
    owner,
    ...(value.paymentConfiguration && !manage && {
      paymentConfiguration: {
        paymentMode: value.paymentConfiguration.paymentMode,
        onlinePaymentStatus: value.paymentConfiguration.onlinePaymentStatus,
      },
    }),
    ...(value.activeQueue && { activeQueue: queueRowsForViewer(value.activeQueue, viewerId) }),
    staff: value.staff?.map(member => {
      const { email: _email, doctorId: _doctorId, currentService: _visitService, ...publicMember } = member.toObject?.() || member;
      return publicMember;
    }),
  };
};

export const create = asyncHandler(async (req, res) => {
  const category = resolveOwnerHubCategory(req.user, req.body.category);
  if (!category) throw new ApiError(403, "Ask the admin to enable this business category.");
  const business = await businessService.createBusiness(req.user._id, { ...req.body, category });
  const io = req.app.get("io");
  if (io) {
    io.emit("service:created", { businessId: business._id, business: publicBusiness(business) });
  }
  await notifyUser({ recipient: req.user._id, type: 'hub', title: 'Hub registered',
    message: `${business.name} has been added to your account.`, href: `/business/${business._id}`,
    eventKey: `hub:registered:${business._id}` }, io);
  res.status(201).json(new ApiResponse(201, { business }, "Business created"));
});

export const getAll = asyncHandler(async (req, res) => {
  const { search, category, location, onlyOpen, lat, lng, radius, onlyWithinRadius } = req.query;
  const businesses = await businessService.getAllBusinesses({
    testOwner: req.user?.role === "admin" ? req.user._id : undefined,
    search,
    category,
    location,
    onlyOpen: onlyOpen !== "false",
    lat,
    lng,
    radius,
    onlyWithinRadius,
  });
  res.set("Cache-Control", "private, no-store");
  res.json(new ApiResponse(200, { businesses: businesses.map(business => publicBusiness(business, req.user?._id)) }));
});

export const getOne = asyncHandler(async (req, res) => {
  const business = await businessService.getBusinessById(req.params.id);
  assertTestVenueAccess(business, req.user?._id);
  res.set("Cache-Control", "private, no-store");
  const viewer = req.user;
  const canManage = viewer?.role === "admin" || (
    viewer?.role === "owner" && business.approvalStatus === "approved" &&
    String(business.owner?._id || business.owner) === String(viewer._id) && canAccessOwnerCategory(viewer, business)
  );
  res.json(new ApiResponse(200, { business: publicBusiness(business, viewer?._id, canManage) }));
});

export const getMine = asyncHandler(async (req, res) => {
  const ownedBusinesses = await businessService.getMyBusinesses(req.user._id);
  const businesses = ownedBusinesses.filter(business => canAccessOwnerCategory(req.user, business));
  res.json(new ApiResponse(200, { businesses }));
});

export const update = asyncHandler(async (req, res) => {
  const business = await businessService.updateBusiness(
    req.params.id,
    req.user._id,
    req.body,
    req.user.role
  );
  const io = req.app.get("io");
  if (io) {
    io.to(`business:${business._id}`).emit("service:updated", { businessId: business._id, business: publicBusiness(business) });
  }
  res.json(new ApiResponse(200, { business }, "Updated"));
});

export const toggle = asyncHandler(async (req, res) => {
  const io = req.app.get("io");
  const business = await businessService.toggleOpen(req.params.id, req.user._id, io);
  res.json(new ApiResponse(200, { business }, `Business is now ${business.isOpen ? "open" : "closed"}`));
});

export const getOnboardingDraft = asyncHandler(async (req, res) => {
  const business = await businessService.getOnboardingDraft(req.user._id, req.query.businessId);
  if (business && !canAccessOwnerCategory(req.user, business)) throw new ApiError(403, "Ask the admin to enable this venue category.");
  if (business && !businessService.isCategoryLocked(business)) {
    business.categorySelectedAt = new Date();
    await business.save();
  }
  res.json(new ApiResponse(200, { business }));
});

export const initOnboarding = asyncHandler(async (req, res) => {
  let business;
  if (req.user.ownerAccess?.applicationId && !req.body.createNew) {
    const application = await BusinessApplication.findOne({_id:req.user.ownerAccess.applicationId,status:"APPROVED"});
    if (!application?.linkedHubId) throw new ApiError(403, "An approved business is required to start onboarding.");
    business = await businessService.getOnboardingDraft(req.user._id, application.linkedHubId);
  } else {
    const category = resolveOwnerHubCategory(req.user, req.body.category);
    if (!category) throw new ApiError(403, "Ask the admin to enable this business category.");
    business = await businessService.initOnboarding(req.user._id, { ...req.body, category });
  }
  if (!canAccessOwnerCategory(req.user, business)) throw new ApiError(403, "Ask the admin to enable this venue category.");
  if (!businessService.isCategoryLocked(business)) {
    business.categorySelectedAt = new Date();
    await business.save();
  }
  if (business.onboarding?.status === 'IN_PROGRESS') await notifyUser({ recipient: req.user._id, type: 'hub', title: 'Your hub setup is ready',
    message: `Continue setting up ${business.name}. Your business category is ${business.category}.`, href: `/business/onboarding/${business._id}`,
    eventKey: `hub:setup:${business._id}` }, req.app.get('io'));
  res.status(201).json(new ApiResponse(201, { business }, "Onboarding session initialized"));
});

export const saveOnboardingStep = asyncHandler(async (req, res) => {
  const { step, data } = req.body;
  const business = await businessService.saveOnboardingStep(
    req.params.id,
    req.user._id,
    step,
    data
  );
  res.json(new ApiResponse(200, { business }, `Step ${step} saved successfully`));
});

export const launchBusiness = asyncHandler(async (req, res) => {
  const io = req.app.get("io");
  const business = await businessService.launchBusiness(req.params.id, req.user._id, io);
  await notifyUser({ recipient: req.user._id, type: 'hub', title: 'Your hub is live',
    message: `${business.name} is ready to welcome customers.`, href: `/business/${business._id}`,
    eventKey: `hub:live:${business._id}` }, io);
  res.json(new ApiResponse(200, { business }, "Your business is ready on ServeQ!"));
});


export const selectCategory = asyncHandler(async (req, res) => {
  if (!canAccessOwnerCategory(req.user, { category: req.body.category })) throw new ApiError(403, "Ask the admin to enable this category.");
  const business = await businessService.selectBusinessCategory(req.params.id, req.user._id, req.body.category);
  res.json(new ApiResponse(200, { business }, "Business category selected"));
});
