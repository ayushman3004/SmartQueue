import { validatePasswordStrength } from "../../utils/validators.js";
import ApiError from "../../../utils/ApiError.js";
export const INVITATION_MS = 5 * 60 * 60 * 1000;
export const PASSWORD_CHANGE_MS = 24 * 60 * 60 * 1000;
export const ownerState = (user, now = Date.now()) => {
  const access = user.ownerAccess;
  if (user.role !== "owner" || !access?.applicationId) return "ACTIVE";
  if (
    access.status === "INVITED" &&
    !(new Date(access.invitationExpiresAt).getTime() > now)
  )
    return "EXPIRED";
  if (access.status !== "ACTIVE") return access.status;
  if (
    access.mustChangePassword &&
    !(new Date(access.passwordChangeDeadline).getTime() > now)
  )
    return "PASSWORD_REQUIRED";
  return "ACTIVE";
};
export const assertOwnerLogin = (user, now) => {
  const state = ownerState(user, now);
  if (state === "EXPIRED")
    throw new ApiError(
      403,
      "Your invitation has expired. Ask ServeQ to issue a new invitation.",
    );
  if (!["ACTIVE", "INVITED", "PASSWORD_REQUIRED"].includes(state))
    throw new ApiError(
      403,
      "This business account is not active. Contact ServeQ.",
    );
};
export const validateOwnerPassword = (password) => {
  if (
    typeof password !== "string" ||
    password.length > 128 ||
    !validatePasswordStrength(password).isValid
  ) {
    throw new ApiError(
      400,
      "Use 8–128 characters including uppercase, lowercase, a number and a symbol.",
    );
  }
};
export const publicOwnerAccess = (user) =>
  user.ownerAccess?.applicationId
    ? {
        status: ownerState(user),
        invitationExpiresAt: user.ownerAccess.invitationExpiresAt,
        firstLoginAt: user.ownerAccess.firstLoginAt,
        mustChangePassword: user.ownerAccess.mustChangePassword,
        passwordChangeDeadline: user.ownerAccess.passwordChangeDeadline,
        passwordChangedAt: user.ownerAccess.passwordChangedAt,
      }
    : undefined;
