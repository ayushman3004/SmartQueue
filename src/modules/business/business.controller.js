import * as businessService from "./business.service.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";

export const create = asyncHandler(async (req, res) => {
  const business = await businessService.createBusiness(req.user._id, req.body);
  res.status(201).json(new ApiResponse(201, { business }, "Business created"));
});

export const getAll = asyncHandler(async (_req, res) => {
  const businesses = await businessService.getAllBusinesses();
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
  const business = await businessService.updateBusiness(req.params.id, req.user._id, req.body);
  res.json(new ApiResponse(200, { business }, "Updated"));
});

export const toggle = asyncHandler(async (req, res) => {
  const business = await businessService.toggleOpen(req.params.id, req.user._id);
  res.json(new ApiResponse(200, { business }, `Business is now ${business.isOpen ? "open" : "closed"}`));
});
