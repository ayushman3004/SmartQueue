import User from "./auth.model.js";
import ApiError from "../../../utils/ApiError.js";
import {
  hashPassword,
  comparePassword,
  generateToken,
} from "../auth.utils.js";

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// ─── Register ─────────────────────────────────────────────────
export const register = async ({ name, email, password, role }) => {
  if (!name || !email || !password) throw new ApiError(400, "Name, email, and password are required");

  const normEmail = (email || "").trim().toLowerCase();
  if (!normEmail || !EMAIL_REGEX.test(normEmail)) {
    throw new ApiError(400, "Invalid email format. Please provide a valid email address (e.g. name@example.com)");
  }

  if (password.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters long");
  }
  if (!/[A-Z]/.test(password)) {
    throw new ApiError(400, "Password must contain at least one capital letter (A-Z)");
  }
  if (!/[a-z]/.test(password)) {
    throw new ApiError(400, "Password must contain at least one lowercase letter (a-z)");
  }
  if (!/[0-9]/.test(password)) {
    throw new ApiError(400, "Password must contain at least one number (0-9)");
  }
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(password)) {
    throw new ApiError(400, "Password must contain at least one special symbol (!@#$%^&*...)");
  }

  const existing = await User.findOne({ email: normEmail });
  if (existing) {
    const userRole = role === "owner" ? "owner" : "customer";
    if (existing.role === "customer" && userRole === "owner") {
      throw new ApiError(
        409,
        "This email is already registered as a Customer. Please sign in to the Business Portal to upgrade your account or use the Customer Portal."
      );
    }
    if (existing.role === "owner" && userRole === "customer") {
      throw new ApiError(
        409,
        "This email is already registered as a Hub Owner. Please sign in via the Business Command Center at /business."
      );
    }
    throw new ApiError(409, "Email already registered");
  }

  // Disallow admin self-registration: only customer or owner permitted
  const userRole = role === "owner" ? "owner" : "customer";
  const hashed = await hashPassword(password);
  const user = await User.create({ name: name.trim(), email: normEmail, password: hashed, role: userRole });

  const token = generateToken(user);
  return { user: sanitize(user), token };
};

// ─── Login ────────────────────────────────────────────────────
export const login = async ({ email, password, requiredRole }) => {
  if (!email || !password) throw new ApiError(400, "Email and password are required");

  const normEmail = (email || "").trim().toLowerCase();
  if (!normEmail || !EMAIL_REGEX.test(normEmail)) {
    throw new ApiError(400, "Invalid email format. Please provide a valid email address (e.g. name@example.com)");
  }

  const adminEmail = (process.env.ADMIN_EMAIL || "admin@serveq.tech").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  let user = await User.findOne({ email: normEmail }).select("+password");

  // Bootstrap or upgrade superadmin if logging in as admin or using admin email
  if ((requiredRole === "admin" || normEmail === adminEmail) && normEmail === adminEmail) {
    if (!user) {
      const hashed = await hashPassword(adminPassword);
      user = await User.create({
        name: "ServeQ Administrator",
        email: adminEmail,
        password: hashed,
        role: "admin",
      });
    } else if (user.role !== "admin") {
      user.role = "admin";
      await user.save();
    }
  }

  if (!user) throw new ApiError(401, "Invalid credentials");

  // Role verification checks
  if (requiredRole === "owner" && user.role !== "owner" && user.role !== "admin") {
    throw new ApiError(
      403,
      "Access restricted to Hub Owners. This account is registered as a Customer. Please sign in at the Customer Portal or upgrade your account to Hub Owner."
    );
  }

  if (requiredRole === "customer" && user.role === "owner") {
    throw new ApiError(
      403,
      "Access restricted to Customers. This account is registered as a Hub Owner. Please sign in via the Business Command Center at /business."
    );
  }

  if (requiredRole === "admin" && user.role !== "admin") {
    throw new ApiError(403, "Access restricted to Administrators. You do not have administrator permissions.");
  }

  if (!user.password)
    throw new ApiError(401, "This account uses Google login. Please sign in with Google.");

  const valid = await comparePassword(password, user.password);
  if (!valid) throw new ApiError(401, "Invalid credentials");

  const token = generateToken(user);
  return { user: sanitize(user), token };
};

// ─── Upgrade Account to Hub Owner ────────────────────────────
export const upgradeToOwner = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  user.role = "owner";
  await user.save();
  return sanitize(user);
};

// ─── Google OAuth (called by Passport) ───────────────────────
export const findOrCreateGoogleUser = async ({ googleId, email, name, avatar, role }) => {
  const selectedRole = role === "owner" ? "owner" : "customer";

  // Check if user already exists by googleId
  let user = await User.findOne({ googleId });
  if (user) {
    // If an existing customer explicitly chooses owner, upgrade their role
    if (selectedRole === "owner" && user.role === "customer") {
      user.role = "owner";
      await user.save();
    }
    return user;
  }

  // Check if email matches an existing local account → merge
  user = await User.findOne({ email });
  if (user) {
    user.googleId = googleId;
    user.authProvider = "both";
    if (!user.avatar) user.avatar = avatar;
    if (selectedRole === "owner" && user.role === "customer") {
      user.role = "owner";
    }
    await user.save();
    return user;
  }

  // New user entirely
  return await User.create({
    name,
    email,
    googleId,
    avatar,
    role: selectedRole,
    authProvider: "google",
  });
};

// ─── Get Profile ──────────────────────────────────────────────
export const getProfile = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  return sanitize(user);
};

// ─── Update Profile ──────────────────────────────────────────
export const updateProfile = async (userId, data) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  // Prevent role updates
  delete data.role;
  delete data.walletBalance;
  delete data._id;
  delete data.email; // Usually emails shouldn't be changed this way for security

  Object.assign(user, data);
  await user.save();
  return sanitize(user);
};

// ─── Private Helpers ─────────────────────────────────────────
const sanitize = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  role: user.role,
  walletBalance: user.walletBalance ?? 0,
  authProvider: user.authProvider,
  phone: user.phone || "",
  bio: user.bio || "",
  location: user.location || "",
});
