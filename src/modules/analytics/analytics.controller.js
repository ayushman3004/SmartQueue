import * as analyticsService from "./analytics.service.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";

export const getAnalytics = asyncHandler(async (req, res) => {
  const { businessId } = req.params;
  const data = await analyticsService.getBusinessAnalytics(
    businessId,
    req.user._id,
    req.user.role
  );
  res.json(new ApiResponse(200, data, "Business analytics retrieved"));
});
