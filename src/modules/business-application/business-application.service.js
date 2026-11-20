import { generateInvitationCredentials } from "./invitation-credentials.js";
import { isValidEmail } from "../../utils/validators.js";
import crypto from "node:crypto";
import mongoose from "mongoose";
import Application from "./business-application.model.js";
import User from "../auth/auth.model.js";
import Business from "../business/business.model.js";
import { hashPassword, comparePassword } from "../auth.utils.js";
import ApiError from "../../../utils/ApiError.js";
import {
  INVITATION_MS,
  PASSWORD_CHANGE_MS,
  ownerState,
  validateOwnerPassword,
} from "./owner-lifecycle.js";
import {
  sendBusinessInvitation,
  sendBusinessNotice,
} from "./business-application.email.js";
export const digestCredential = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
const text = (value, max, required = true) => {
  if (typeof value !== "string" || value.length > max)
    throw new ApiError(
      400,
      "Please check the application fields and their lengths.",
    );
  const clean = value
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001f]/g, " ")
    .trim();
  if (required && !clean)
    throw new ApiError(400, "Please complete all required fields.");
  return clean;
};
export const validateApplication = (input = {}) => {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ApiError(400, "Invalid application.");
  const data = {};
  for (const [key, limit] of Object.entries({
    businessName: 160,
    ownerName: 120,
    email: 254,
    phone: 24,
    businessAddress: 400,
    city: 100,
    description: 2000,
  }))
    data[key] = text(input[key], limit);
  data.email = data.email.toLowerCase();
  if (!isValidEmail(data.email) || !/^\+?[\d ()-]{8,24}$/.test(data.phone))
    throw new ApiError(400, "Enter a valid email and contact number.");
  if (
    !["salon", "clinic", "healthcare", "other"].includes(input.businessCategory)
  )
    throw new ApiError(400, "Choose a business category.");
  data.businessCategory = input.businessCategory;
  if (input.privacyAcknowledged !== true)
    throw new ApiError(400, "Please acknowledge the privacy notice.");
  data.comments = text(input.comments || "", 2000, false);
  data.website = text(input.website || "", 500, false);
  if (data.website) {
    let url;
    try {
      url = new URL(data.website);
    } catch {
      throw new ApiError(400, "Use a complete website or social profile URL.");
    }
    if (!["https:", "http:"].includes(url.protocol))
      throw new ApiError(400, "Use an HTTPS or HTTP website.");
  }
  if (input.employees !== undefined && input.employees !== "") {
    const employees = Number(input.employees);
    if (!Number.isInteger(employees) || employees < 1 || employees > 100000)
      throw new ApiError(400, "Enter a valid employee count.");
    data.employees = employees;
  }
  return data;
};
// Generic confirmation prevents email/account enumeration, including duplicate submissions.
export const submitApplication = async (input) => {
  const data = validateApplication(input);
  const confirmation = {
    message:
      "Thank you. If no application is already under review, our team will review your details and email you with the next steps.",
  };
  try {
    await Application.create({
      ...data,
      privacyAcknowledgedAt: new Date(),
    });
    await sendBusinessNotice({
      to: data.email,
      subject: "We received your ServeQ application",
      lines: [
        `Thank you, ${data.ownerName}. Our team will review ${data.businessName}. Submitting an application does not create an owner account. We will contact you after review.`,
      ],
    }).catch(() => false);
    return confirmation;
  } catch (error) {
    if (error.code === 11000) return confirmation;
    throw error;
  }
};
export const listApplications = async ({ status, search = "", page = 1 }) => {
  // Expiry is also enforced at authentication; this update only refreshes admin visibility.
  await User.updateMany(
    {
      "ownerAccess.status": "INVITED",
      "ownerAccess.invitationExpiresAt": {
        $lte: new Date(),
      },
    },
    {
      $set: {
        "ownerAccess.status": "EXPIRED",
      },
      $unset: {
        "ownerAccess.activationTokenHash": 1,
      },
    },
  );
  const filter = {};
  if (["PENDING", "APPROVED", "REJECTED"].includes(status))
    filter.status = status;
  if (status === "EXPIRED") {
    filter.status = "APPROVED";
    filter["invitation.expiresAt"] = {
      $lte: new Date(),
    };
    filter["invitation.activatedAt"] = {
      $exists: false,
    };
  }
  if (search) {
    const safe = String(search)
      .slice(0, 120)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = ["email", "businessName", "ownerName", "city"].map((key) => ({
      [key]: {
        $regex: safe,
        $options: "i",
      },
    }));
  }
  const currentPage = Math.max(1, Math.min(10000, Number(page) || 1));
  const [applications, total] = await Promise.all([
    Application.find(filter)
      .sort({
        submittedAt: -1,
      })
      .skip((currentPage - 1) * 30)
      .limit(30)
      .lean(),
    Application.countDocuments(filter),
  ]);
  return {
    applications,
    total,
    page: currentPage,
  };
};
export const reviewApplication = async (
  id,
  actor,
  action,
  notes = "",
  now = new Date(),
) => {
  if (actor.role !== "admin")
    throw new ApiError(403, "Administrator access required.");
  if (!mongoose.isValidObjectId(id))
    throw new ApiError(400, "Invalid application.");
  const reviewNotes = text(notes, 2000, false);
  if (action === "reject") {
    const rejected = await Application.findOneAndUpdate(
      {
        _id: id,
        status: "PENDING",
      },
      {
        $set: {
          status: "REJECTED",
          reviewedAt: now,
          rejectedAt: now,
          reviewedBy: actor._id,
          reviewNotes,
        },
        $push: {
          audit: {
            action: "REJECTED",
            at: now,
            actor: actor._id,
          },
        },
      },
      {
        new: true,
      },
    );
    if (!rejected)
      throw new ApiError(409, "This application has already been reviewed.");
    return rejected;
  }
  if (!["approve", "reissue"].includes(action))
    throw new ApiError(400, "Invalid review action.");
  // Transactions are required: never provision a partially approved owner on standalone MongoDB.
  const { password, credential } = generateInvitationCredentials();
  const passwordHash = await hashPassword(password);
  const generation = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + INVITATION_MS);
  let application;
  await mongoose.connection.transaction(async (session) => {
    application = await Application.findById(id).session(session);
    if (
      !application ||
      (action === "approve"
        ? application.status !== "PENDING"
        : application.status !== "APPROVED")
    )
      throw new ApiError(
        409,
        "This application is not eligible for this action.",
      );
    let owner;
    if (action === "approve") {
      if (
        await User.findOne({
          email: application.email,
        }).session(session)
      )
        throw new ApiError(
          409,
          "This email already belongs to an account. Review the identity before proceeding.",
        );
      [owner] = await User.create(
        [
          {
            name: application.ownerName,
            email: application.email,
            phone: application.phone,
            role: "owner",
            password: passwordHash,
          },
        ],
        {
          session,
        },
      );
      const [hub] = await Business.create(
        [
          {
            name: application.businessName,
            owner: owner._id,
            category: application.businessCategory,
            email: application.email,
            phone: application.phone,
            address: application.businessAddress,
            location: application.city,
            locationDetails: {
              city: application.city,
            },
            description: application.description,
            approvalStatus: "approved",
            isActive: false,
            onboarding: {
              status: "IN_PROGRESS",
              currentStep: 1,
              completedSteps: [],
            },
          },
        ],
        {
          session,
        },
      );
      application.linkedUserId = owner._id;
      application.linkedHubId = hub._id;
    } else {
      owner = await User.findById(application.linkedUserId).session(session);
      if (!owner || !["INVITED", "EXPIRED"].includes(owner.ownerAccess?.status))
        throw new ApiError(
          409,
          "Only unactivated invitations may be reissued.",
        );
    }
    owner.password = passwordHash;
    owner.isEmailVerified = false;
    owner.tokenVersion = (owner.tokenVersion || 0) + 1;
    owner.ownerAccess = {
      applicationId: application._id,
      status: "INVITED",
      activationTokenHash: digestCredential(credential),
      invitationIssuedAt: now,
      invitationExpiresAt: expiresAt,
      mustChangePassword: true,
    };
    await owner.save({
      session,
    });
    application.status = "APPROVED";
    application.reviewedAt = now;
    application.reviewedBy = actor._id;
    application.reviewNotes = reviewNotes;
    application.invitation = {
      generation,
      issuedAt: now,
      expiresAt,
      delivery: "PENDING",
    };
    application.audit.push({
      action: action === "approve" ? "APPROVED" : "INVITATION_REISSUED",
      at: now,
      actor: actor._id,
    });
    await application.save({
      session,
    });
  });
  let sent = false;
  try {
    sent = await sendBusinessInvitation({
      application,
      password,
      credential,
      expiresAt,
    });
  } catch {
    /* Record only delivery state; provider errors can contain credentials. */
  }
  await Application.updateOne(
    {
      _id: id,
      "invitation.generation": generation,
    },
    {
      $set: {
        "invitation.delivery": sent ? "SENT" : "FAILED",
        ...(sent
          ? {
              "invitation.deliveredAt": new Date(),
            }
          : {}),
      },
    },
  );
  return Application.findById(id);
};
export const validateInvitation = async (
  user,
  credential,
  now = Date.now(),
) => {
  if (
    ownerState(user, now) !== "INVITED" ||
    typeof credential !== "string" ||
    !/^[0-9]{6}$/.test(credential)
  )
    throw new ApiError(
      403,
      "Invitation is invalid or expired. Request a new invitation from ServeQ.",
    );
  const record = await User.findById(user._id).select(
    "+ownerAccess.activationTokenHash",
  );
  const expected = record?.ownerAccess?.activationTokenHash;
  const supplied = digestCredential(credential);
  if (
    !expected ||
    !/^[a-f0-9]{64}$/.test(expected) ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))
  )
    throw new ApiError(403, "Invalid invitation credentials.");
};
export const activateOwner = async (user, now = new Date()) => {
  let activated;
  await mongoose.connection.transaction(async (session) => {
    activated = await User.findOneAndUpdate(
      {
        _id: user._id,
        tokenVersion: user.tokenVersion || 0,
        "ownerAccess.status": "INVITED",
        "ownerAccess.invitationExpiresAt": {
          $gt: now,
        },
      },
      {
        $set: {
          isEmailVerified: true,
          "ownerAccess.status": "ACTIVE",
          "ownerAccess.activatedAt": now,
          "ownerAccess.firstLoginAt": now,
          "ownerAccess.passwordChangeDeadline": new Date(
            now.getTime() + PASSWORD_CHANGE_MS,
          ),
          "ownerAccess.mustChangePassword": true,
        },
        $unset: {
          "ownerAccess.activationTokenHash": 1,
        },
        $inc: {
          tokenVersion: 1,
        },
      },
      {
        new: true,
        session,
      },
    );
    if (!activated)
      throw new ApiError(
        409,
        "Invitation has expired, was reissued, or has already been activated. Please sign in again.",
      );
    await Application.updateOne(
      {
        _id: activated.ownerAccess.applicationId,
      },
      {
        $set: {
          "invitation.activatedAt": now,
        },
        $push: {
          audit: {
            action: "ACTIVATED",
            at: now,
            actor: activated._id,
          },
        },
      },
      {
        session,
      },
    );
  });
  await sendBusinessNotice({
    to: activated.email,
    subject: "Your ServeQ account is active — change your password",
    lines: [
      `Your account is active. Change your temporary password before ${activated.ownerAccess.passwordChangeDeadline.toISOString()} (UTC). Open ${(process.env.CLIENT_URL || "https://www.serveq.tech").replace(/\/$/, "")}/hub/change-password.`,
    ],
  }).catch(() => false);
  return activated;
};
export const changeOwnerPassword = async (
  userId,
  currentPassword,
  newPassword,
  now = new Date(),
) => {
  validateOwnerPassword(newPassword);
  const user = await User.findById(userId).select("+password");
  if (
    !user ||
    user.role !== "owner" ||
    !["ACTIVE", "PASSWORD_REQUIRED"].includes(ownerState(user, now.getTime()))
  )
    throw new ApiError(403, "Activate your owner account first.");
  if (!user.password)
    throw new ApiError(
      400,
      "Use password recovery to set a password for this account.",
    );
  if (
    typeof currentPassword !== "string" ||
    !(await comparePassword(currentPassword, user.password))
  )
    throw new ApiError(400, "Current password is incorrect.");
  if (await comparePassword(newPassword, user.password))
    throw new ApiError(
      400,
      "Choose a different password from your temporary password.",
    );
  const updated = await User.findOneAndUpdate(
    {
      _id: userId,
      ...(user.tokenVersion
        ? { tokenVersion: user.tokenVersion }
        : { $or: [{ tokenVersion: 0 }, { tokenVersion: { $exists: false } }] }),
      password: user.password,
    },
    {
      $set: {
        password: await hashPassword(newPassword),
        "ownerAccess.mustChangePassword": false,
        "ownerAccess.passwordChangedAt": now,
      },
      $inc: {
        tokenVersion: 1,
      },
    },
    {
      new: true,
    },
  );
  if (!updated) throw new ApiError(409, "Your account changed. Sign in again.");
  return updated;
};
