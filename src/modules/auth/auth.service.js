import { hasVerifiedPhone, normalizePhoneNumber } from '../../utils/phoneNumbers.js';
import { ownerState, assertOwnerLogin, publicOwnerAccess } from "../business-application/owner-lifecycle.js";
import { validateInvitation } from "../business-application/business-application.service.js";
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
  if (role && role !== "customer") throw new ApiError(403, "Business registration is invitation-only. Apply at /business/apply.");
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
  if (existing) throw new ApiError(409, "Email already registered. Sign in or use account recovery.");

  // Public registration creates customers only; owners are admin-provisioned.
  const userRole = "customer";
  const hashed = await hashPassword(password);
  const user = await User.create({ name: name.trim(), email: normEmail, password: hashed, role: userRole });

  const token = generateToken(user);
  return { user: sanitize(user), token };
};

// ─── Login ────────────────────────────────────────────────────
export const login = async ({ email, password, requiredRole, activationCredential }) => {
  if (!email || !password) throw new ApiError(400, "Email and password are required");

  const normEmail = (email || "").trim().toLowerCase();
  if (!normEmail || !EMAIL_REGEX.test(normEmail)) {
    throw new ApiError(400, "Invalid email format. Please provide a valid email address (e.g. name@example.com)");
  }

  // Sign-in only authenticates existing accounts; it never provisions roles.
  const user = await User.findOne({ email: normEmail }).select("+password");

  if (!user) throw new ApiError(401, "Invalid credentials");

  if (!user.password) throw new ApiError(401, "Invalid credentials. Use your existing sign-in method.");
  const valid = await comparePassword(password, user.password);
  if (!valid) throw new ApiError(401, "Invalid credentials");

  // Role verification checks
  if (requiredRole === "owner" && user.role !== "owner" && user.role !== "admin") {
    throw new ApiError(
      403,
      "Access restricted to Hub Owners. This account is registered as a Customer. Customer accounts cannot be upgraded to Hub Owner."
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

  if (user.role === "owner") {
    if (ownerState(user) === "EXPIRED" && user.ownerAccess?.status === "INVITED") {
      await User.updateOne({_id:user._id,"ownerAccess.status":"INVITED","ownerAccess.invitationExpiresAt":{$lte:new Date()}}, {$set:{"ownerAccess.status":"EXPIRED"},$unset:{"ownerAccess.activationTokenHash":1}});
    }
    assertOwnerLogin(user);
    if (ownerState(user) === "INVITED") {
      if (typeof activationCredential !== "string" || !activationCredential.trim()) {
        const activationRequired = new ApiError(403, "Enter the activation code from your approval email to continue to email verification.");
        activationRequired.code = "OWNER_ACTIVATION_REQUIRED";
        throw activationRequired;
      }
      await validateInvitation(user, activationCredential);
    }
  }
  const token = generateToken(user);
  return { user: sanitize(user), token };
};

// ─── Upgrade Account to Hub Owner (Permanently Disabled) ────
export const upgradeToOwner = async () => {
  throw new ApiError(
    403,
    "Customer accounts cannot be upgraded to Hub Owner. Once registered as a Customer, role cannot be converted."
  );
};

// ─── Google OAuth (called by Passport) ───────────────────────
export const findOrCreateGoogleUser = async ({ googleId, email, name, avatar, role }) => {
  const selectedRole = role === "owner" ? "owner" : "customer";
  const normalizedEmail = (email || "").toLowerCase().trim();

  // Check if user already exists by googleId
  let user = await User.findOne({ googleId });
  if (user) {
    // If account exists as customer, do not allow Hub Owner login
    if (selectedRole === "owner" && user.role === "customer") {
      throw new ApiError(
        403,
        "This email is registered as a Customer. Hub Owner login is not allowed for customer accounts."
      );
    }
    if (user.role === "owner" && user.ownerAccess?.applicationId && ownerState(user) !== "ACTIVE") throw new ApiError(403, "Complete your invitation using password login and email OTP.");
    if (normalizedEmail === user.email && ["google", "both"].includes(user.authProvider) && !user.isEmailVerified) {
      user.isEmailVerified = true;
      await user.save();
    }
    return user;
  }

  // Check if email matches an existing local or Google account
  if (normalizedEmail) {
    user = await User.findOne({ email: normalizedEmail });
    if (user) {
      // If existing user is customer, do not allow Hub Owner login
      if (selectedRole === "owner" && user.role === "customer") {
        throw new ApiError(
          403,
          "This email is registered as a Customer. Hub Owner login is not allowed for customer accounts."
        );
      }
      if (user.role === "owner" && user.ownerAccess?.applicationId && ownerState(user) !== "ACTIVE") throw new ApiError(403, "Complete your invitation using password login and email OTP.");
      user.googleId = googleId;
      if (user.authProvider === "local") {
        user.authProvider = "both";
      }
      user.isEmailVerified = true;
      if (!user.avatar && avatar) user.avatar = avatar;
      await user.save();
      return user;
    }
  }

  if (selectedRole === "owner") throw new ApiError(403, "Business registration is invitation-only. Apply at /business/apply.");

  // New user entirely
  return await User.create({
    name,
    email: normalizedEmail,
    googleId,
    avatar,
    role: selectedRole,
    authProvider: "google",
    isEmailVerified: true,
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
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new ApiError(400, "Invalid profile payload.");

  // Copy only own, explicitly editable fields. Never mutate or assign the request body.
  const changes = {};
  for (const key of ["name", "email", "avatar", "phone", "bio", "location"]) {
    if (!Object.hasOwn(data, key)) continue;
    if (typeof data[key] !== "string") throw new ApiError(400, "Invalid profile field.");
    changes[key] = data[key];
  }
  if (changes.name !== undefined) {
    changes.name = changes.name.trim();
    if (!changes.name) throw new ApiError(400, "Name is required.");
  }
  if (changes.email !== undefined) {
    changes.email = changes.email.toLowerCase().trim();
    if (!EMAIL_REGEX.test(changes.email)) throw new ApiError(400, "Invalid email.");
  }
  if (changes.phone !== undefined) {
    changes.phone = normalizePhoneNumber(changes.phone, { allowEmpty: true });
    if (changes.phone === null) throw new ApiError(400, "Invalid phone number. Include its country code.");
  }

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  if (changes.email !== undefined && changes.email !== user.email) {
    if (user.ownerAccess?.applicationId) throw new ApiError(403, "Contact ServeQ to change an approved business login email.");
    const existing = await User.findOne({ email: changes.email });
    if (existing && String(existing._id) !== String(user._id)) throw new ApiError(400, "Email is already taken by another account");
  }

  if (changes.email !== undefined && changes.email !== user.email) user.isEmailVerified = false;
  if (changes.phone !== undefined && (!changes.phone || changes.phone !== normalizePhoneNumber(user.phone || "", { allowEmpty: true }))) {
    user.isPhoneVerified = false;
    user.phoneVerification = undefined;
  }
  for (const key of Object.keys(changes)) user[key] = changes[key];
  await user.save();
  return sanitize(user);
};

// ─── Private Helpers ─────────────────────────────────────────
export const sanitize = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  role: user.role,
  walletBalance: user.walletBalance ?? 0,
  authProvider: user.authProvider,
  phone: user.phone || "",
  isPhoneVerified: hasVerifiedPhone(user),
  isEmailVerified: Boolean(user.isEmailVerified),
  bio: user.bio || "",
  location: user.location || "",
  businessCategories: user.businessCategories || [],
  ownerAccess: publicOwnerAccess(user),
  subscription: user.subscription || { plan: "NONE", status: "INACTIVE", amount: 0 },
});
