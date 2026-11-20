import { Router } from "express";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import { createRateLimiter } from "../../gateway/rateLimiter.js";
import {
  submitApplication,
  deleteApplication,
  resendApplicationAcknowledgement,
  listApplications,
  reviewApplication,
  changeOwnerPassword,
} from "./business-application.service.js";
import { protect, allowRoles } from "../../../middleware/auth.middleware.js";
import { generateToken, setTokenCookie } from "../auth.utils.js";
import { sanitize } from "../auth/auth.service.js";
export const applicationRoutes = Router();
applicationRoutes.post(
  "/",
  createRateLimiter({
    windowMs: 3600000,
    max: 5,
  }),
  asyncHandler(async (req, res) => {
    const result = await submitApplication(req.body);
    res.status(202).json(new ApiResponse(202, result, result.message));
  }),
);
export const adminApplicationRoutes = Router();
adminApplicationRoutes.use(protect, allowRoles("admin"));
adminApplicationRoutes.get(
  "/",
  asyncHandler(async (req, res) =>
    res.json(new ApiResponse(200, await listApplications(req.query))),
  ),
);
adminApplicationRoutes.delete("/:id", asyncHandler(async (req, res) => {
  if (req.body?.confirm !== "DELETE ACCESS") return res.status(400).json({ message: "Confirm access deletion first." });
  const result = await deleteApplication(req.params.id, req.user);
  res.json(new ApiResponse(200, result, result.message));
}));
adminApplicationRoutes.post("/:id/resend-acknowledgement", asyncHandler(async (req, res) => {
  const application = await resendApplicationAcknowledgement(req.params.id, req.user);
  res.json(new ApiResponse(200, { application }));
}));
adminApplicationRoutes.post(
  "/:id/:action",
  asyncHandler(async (req, res) =>
    res.json(
      new ApiResponse(200, {
        application: await reviewApplication(
          req.params.id,
          req.user,
          req.params.action,
          req.body.notes || "",
        ),
      }),
    ),
  ),
);
export const changePasswordHandler = asyncHandler(async (req, res) => {
  const user = await changeOwnerPassword(
    req.user._id,
    req.body.currentPassword,
    req.body.newPassword,
  );
  req.app.get("io")?.in(`user:${user._id}`).disconnectSockets(true);
  const token = generateToken(user);
  setTokenCookie(res, token, req);
  res.json(
    new ApiResponse(
      200,
      {
        user: sanitize(user),
        token,
      },
      "Password changed. All previous sessions have been invalidated.",
    ),
  );
});
