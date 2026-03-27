import User from "./auth.model.js";
import ApiError from "../../../utils/ApiError.js";
import {
  hashPassword,
  comparePassword,
  generateToken,
} from "../auth.utils.js";

// ─── Register ─────────────────────────────────────────────────
export const register = async ({ name, email, password, role }) => {
  if (!name || !email || !password) throw new ApiError(400, "Name, email, and password are required");
  if (password.length < 6) throw new ApiError(400, "Password must be at least 6 characters");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, "Invalid email format");

  const existing = await User.findOne({ email });
  if (existing) throw new ApiError(409, "Email already registered");

  const userRole = ["user", "owner"].includes(role) ? role : "user";
  const hashed = await hashPassword(password);
  const user = await User.create({ name: name.trim(), email, password: hashed, role: userRole });

  const token = generateToken(user);
  return { user: sanitize(user), token };
};

// ─── Login ────────────────────────────────────────────────────
export const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select("+password");
  if (!user) throw new ApiError(401, "Invalid credentials");

  if (!user.password)
    throw new ApiError(401, "This account uses Google login. Please sign in with Google.");

  const valid = await comparePassword(password, user.password);
  if (!valid) throw new ApiError(401, "Invalid credentials");

  const token = generateToken(user);
  return { user: sanitize(user), token };
};

// ─── Google OAuth (called by Passport) ───────────────────────
export const findOrCreateGoogleUser = async ({ googleId, email, name, avatar }) => {
  // Check if user already exists by googleId
  let user = await User.findOne({ googleId });
  if (user) return user;

  // Check if email matches an existing local account → merge
  user = await User.findOne({ email });
  if (user) {
    user.googleId = googleId;
    user.authProvider = "both";
    if (!user.avatar) user.avatar = avatar;
    await user.save();
    return user;
  }

  // New user entirely
  return await User.create({
    name,
    email,
    googleId,
    avatar,
    authProvider: "google",
  });
};

// ─── Get Profile ──────────────────────────────────────────────
export const getProfile = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  return sanitize(user);
};

// ─── Private Helpers ─────────────────────────────────────────
const sanitize = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  role: user.role,
  authProvider: user.authProvider,
});
