import * as authService from "./auth.service.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import { generateToken, setTokenCookie } from "../auth.utils.js";

export const signup = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  const { user, token } = await authService.register({ name, email, password, role });
  setTokenCookie(res, token);
  res.status(201).json(new ApiResponse(201, { user, token }, "Registered successfully"));
});

export const signin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { user, token } = await authService.login({ email, password });
  setTokenCookie(res, token);
  res.json(new ApiResponse(200, { user, token }, "Logged in successfully"));
});

export const googleCallback = asyncHandler(async (req, res) => {
  // User attached by Passport
  const token = generateToken(req.user);
  setTokenCookie(res, token);
  // Redirect to frontend with token in query (client stores it)
  res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
});

export const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user._id);
  res.json(new ApiResponse(200, { user }));
});

export const logout = asyncHandler(async (_req, res) => {
  res.clearCookie("token");
  res.json(new ApiResponse(200, {}, "Logged out successfully"));
});
