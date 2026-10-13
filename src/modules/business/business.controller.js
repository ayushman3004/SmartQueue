import * as businessService from "./business.service.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";

export const create = asyncHandler(async (req, res) => {
  const business = await businessService.createBusiness(req.user._id, req.body);
  const io = req.app.get("io");
  if (io) {
    io.emit("service:created", { businessId: business._id, business });
  }
  res.status(201).json(new ApiResponse(201, { business }, "Business created"));
});

export const getAll = asyncHandler(async (req, res) => {
  const { search, category, location, onlyOpen } = req.query;
  const businesses = await businessService.getAllBusinesses({
    search,
    category,
    location,
    onlyOpen: onlyOpen !== "false",
  });
  res.json(new ApiResponse(200, { businesses }));
});

export const getOne = asyncHandler(async (req, res) => {
  const business = await businessService.getBusinessById(req.params.id);
  res.json(new ApiResponse(200, { business }));
});

export const getMine = asyncHandler(async (req, res) => {
  const businesses = await businessService.getMyBusinesses(req.user._id);
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
    io.to(`business:${business._id}`).emit("service:updated", { businessId: business._id, business });
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
  res.json(new ApiResponse(200, { business }));
});

export const initOnboarding = asyncHandler(async (req, res) => {
  const business = await businessService.initOnboarding(req.user._id, req.body);
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
  res.json(new ApiResponse(200, { business }, "Your business is ready on ServeQ!"));
});

