import { initOnboarding as initOnboardingHandler } from "../src/modules/business/business.controller.js";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import Application from "../src/modules/business-application/business-application.model.js";
import User from "../src/modules/auth/auth.model.js";
import Business from "../src/modules/business/business.model.js";
import {
  submitApplication,
  validateApplication,
  reviewApplication,
  activateOwner,
  validateInvitation,
  changeOwnerPassword,
  digestCredential,
} from "../src/modules/business-application/business-application.service.js";
import {
  INVITATION_MS,
  PASSWORD_CHANGE_MS,
  ownerState,
  publicOwnerAccess,
} from "../src/modules/business-application/owner-lifecycle.js";
import {
  register,
  login,
  findOrCreateGoogleUser,
  updateProfile,
} from "../src/modules/auth/auth.service.js";
import { verifyEmailVerificationOtp } from "../src/modules/auth/verification.service.js";
import { resetPassword } from "../src/modules/auth/forgotPassword.service.js";
import {
  hashPassword,
  comparePassword,
  generateToken,
} from "../src/modules/auth.utils.js";
import { protect, allowRoles } from "../middleware/auth.middleware.js";
import { cookieOriginGuard } from "../middleware/cookie-origin.middleware.js";
import {
  initOnboarding,
  updateBusiness,
} from "../src/modules/business/business.service.js";
const id = "507f1f77bcf86cd799439011",
  uid = "507f1f77bcf86cd799439012",
  hid = "507f1f77bcf86cd799439013";
const actor = {
  _id: "507f1f77bcf86cd799439014",
  role: "admin",
};
const input = {
  businessName: "Aster Clinic",
  ownerName: "Asha Sen",
  email: "ASHA@example.com",
  phone: "+919876543210",
  businessCategory: "clinic",
  businessAddress: "12 Market Road",
  city: "Kolkata",
  description: "Haircuts and styling",
  privacyAcknowledged: true,
};
process.env.JWT_SECRET = "admission-test-secret";
const query = (value) => ({
  select: async () => value,
  session: async () => value,
  sort() {
    return this;
  },
  then(resolve, reject) {
    return Promise.resolve(value).then(resolve, reject);
  },
});
function assign(target, update) {
  for (const [key, value] of Object.entries(update.$set || {})) {
    const path = key.split(".");
    let obj = target;
    while (path.length > 1) {
      const part = path.shift();
      obj[part] ||= {};
      obj = obj[part];
    }
    obj[path[0]] = value;
  }
  for (const [key, value] of Object.entries(update.$inc || {}))
    target[key] = (target[key] || 0) + value;
  for (const key of Object.keys(update.$unset || {})) {
    const path = key.split(".");
    let obj = target;
    while (path.length > 1) obj = obj[path.shift()];
    delete obj[path[0]];
  }
}
function fixture(t) {
  const store = {
    application: null,
    user: null,
    hub: null,
    messages: [],
    delivery: true,
    createdUsers: 0,
    createdHubs: 0,
  };
  const oldKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = "unit-test-only";
  t.after(() => {
    if (oldKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = oldKey;
  });
  t.mock.method(globalThis, "fetch", async (_url, request) => {
    store.messages.push(JSON.parse(request.body));
    return {
      ok: store.delivery,
      status: store.delivery ? 200 : 503,
      json: async () => ({
        id: "mock-message",
      }),
    };
  });
  let tail = Promise.resolve();
  t.mock.method(mongoose.connection, "transaction", (callback) => {
    const result = tail.then(() => callback({}));
    tail = result.catch(() => {});
    return result;
  });
  t.mock.method(Application, "create", async (data) => {
    if (store.application && store.application.status !== "REJECTED") {
      const error = new Error("duplicate");
      error.code = 11000;
      throw error;
    }
    store.application = {
      _id: id,
      ...data,
      status: "PENDING",
      audit: [],
      save: async () => {},
    };
    return store.application;
  });
  t.mock.method(Application, "findById", () => query(store.application));
  t.mock.method(Application, "updateOne", async (filter, update) => {
    if (
      filter["invitation.generation"] &&
      store.application.invitation.generation !==
        filter["invitation.generation"]
    )
      return;
    assign(store.application, update);
    if (update.$push?.audit) store.application.audit.push(update.$push.audit);
  });
  t.mock.method(Application, "findOneAndUpdate", async (filter, update) => {
    if (store.application.status !== filter.status) return null;
    assign(store.application, update);
    return store.application;
  });
  t.mock.method(User, "findOne", () => query(store.user));
  t.mock.method(User, "findById", () => query(store.user));
  t.mock.method(User, "create", async (data) => {
    store.createdUsers++;
    const value = Array.isArray(data) ? data[0] : data;
    store.user = {
      _id: uid,
      tokenVersion: 0,
      ...value,
      save: async () => {},
    };
    return Array.isArray(data) ? [store.user] : store.user;
  });
  t.mock.method(User, "findOneAndUpdate", async (filter, update) => {
    const user = store.user;
    if (!user || filter.tokenVersion !== user.tokenVersion) return null;
    if (
      filter["ownerAccess.status"] &&
      filter["ownerAccess.status"] !== user.ownerAccess.status
    )
      return null;
    if (
      filter["ownerAccess.invitationExpiresAt"] &&
      !(
        user.ownerAccess.invitationExpiresAt >
        filter["ownerAccess.invitationExpiresAt"].$gt
      )
    )
      return null;
    if (filter.password && filter.password !== user.password) return null;
    assign(user, update);
    return user;
  });
  t.mock.method(Business, "create", async (data) => {
    store.createdHubs++;
    store.hub = {
      _id: hid,
      ...data[0],
    };
    return [store.hub];
  });
  t.mock.method(Business, "findOne", () => query(store.hub));
  return store;
}
async function pending(t) {
  const store = fixture(t);
  await submitApplication(input);
  return store;
}
async function approved(t) {
  const store = await pending(t);
  await reviewApplication(id, actor, "approve", "Verified identity");
  return store;
}
const invitation = (store) => {
  const body = store.messages.findLast((message) =>
    message.subject.includes("activate your"),
  );
  return {
    password: body.text.match(/Temporary password: (.+)/)[1],
    credential: body.text.match(/activation code: (.+)/)[1],
  };
};
const middleware = async (fn, req) => {
  let error;
  await fn(req, {}, (value) => {
    error = value;
  });
  if (error) throw error;
};
test("application and owner activation lifecycle", async (t) => {
  await t.test(
    "public application is sanitized and pending without provisioning",
    async (t) => {
      const s = await pending(t);
      assert.equal(s.application.email, "asha@example.com");
      assert.equal(s.application.status, "PENDING");
      assert.equal(s.user, null);
      assert.equal(s.hub, null);
      assert.equal(
        validateApplication({
          ...input,
          businessName: "<b>Aster</b>",
        }).businessName,
        "Aster",
      );
    },
  );
  await t.test("duplicates return the same generic confirmation", async (t) => {
    const s = await pending(t);
    const result = await submitApplication(input);
    assert.match(result.message, /Thank you/);
    assert.equal(s.createdUsers, 0);
    assert.equal(s.messages.length, 1);
  });
  await t.test(
    "requires privacy acknowledgement and validates optional URLs",
    () => {
      assert.throws(
        () =>
          validateApplication({
            ...input,
            privacyAcknowledged: false,
          }),
        /privacy/,
      );
      assert.throws(
        () =>
          validateApplication({
            ...input,
            website: "javascript:alert(1)",
          }),
        /HTTPS/,
      );
    },
  );
  await t.test("customers cannot review applications", async () => {
    await assert.rejects(
      reviewApplication(
        id,
        {
          ...actor,
          role: "customer",
        },
        "approve",
      ),
      {
        statusCode: 403,
      },
    );
    await assert.rejects(
      middleware(allowRoles("admin"), {
        user: {
          role: "owner",
        },
      }),
      {
        statusCode: 403,
      },
    );
  });
  await t.test(
    "approval provisions hashed owner and compatible inactive draft atomically",
    async (t) => {
      const s = await approved(t),
        creds = invitation(s);
      assert.equal(s.application.status, "APPROVED");
      assert.equal(s.user.role, "owner");
      assert.equal(creds.password.length, 8);
      assert.match(creds.credential, /^[0-9]{6}$/);
      assert.equal(s.user.ownerAccess.status, "INVITED");
      assert.equal(s.hub.owner, uid);
      assert.equal(s.hub.onboarding.status, "IN_PROGRESS");
      assert.equal(s.hub.isActive, false);
      assert.equal(
        await comparePassword(creds.password, s.user.password),
        true,
      );
      assert.equal(
        s.user.ownerAccess.activationTokenHash,
        digestCredential(creds.credential),
      );
      assert.equal(
        s.user.ownerAccess.invitationExpiresAt -
          s.user.ownerAccess.invitationIssuedAt,
        INVITATION_MS,
      );
      assert.ok(!JSON.stringify(s.application).includes(creds.password));
      assert.ok(
        !JSON.stringify(publicOwnerAccess(s.user)).includes(creds.credential),
      );
      assert.ok(!s.messages.at(-1).text.includes(`?token=`));
    },
  );
  await t.test(
    "email failure is visible and retry reuses account and draft",
    async (t) => {
      const s = await pending(t);
      s.delivery = false;
      await reviewApplication(id, actor, "approve");
      assert.equal(s.application.invitation.delivery, "FAILED");
      const hash = s.user.password;
      s.delivery = true;
      await reviewApplication(id, actor, "reissue");
      assert.equal(s.application.invitation.delivery, "SENT");
      assert.notEqual(hash, s.user.password);
      assert.equal(s.createdUsers, 1);
      assert.equal(s.createdHubs, 1);
    },
  );
  await t.test("concurrent approvals cannot provision twice", async (t) => {
    const s = await pending(t);
    const results = await Promise.allSettled([
      reviewApplication(id, actor, "approve"),
      reviewApplication(id, actor, "approve"),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(s.createdUsers, 1);
    assert.equal(s.createdHubs, 1);
  });
  await t.test(
    "reject preserves audit record and creates no owner",
    async (t) => {
      const s = await pending(t);
      await reviewApplication(id, actor, "reject", "Not a verifiable business");
      assert.equal(s.application.status, "REJECTED");
      assert.equal(s.createdUsers, 0);
      assert.equal(s.application.reviewNotes, "Not a verifiable business");
    },
  );
  await t.test(
    "first password login requires single-use invitation code and returns limited JWT",
    async (t) => {
      const s = await approved(t),
        creds = invitation(s);
      await assert.rejects(
        login({
          email: s.user.email,
          password: creds.password,
          requiredRole: "owner",
        }),
        { statusCode: 403, code: "OWNER_ACTIVATION_REQUIRED" },
      );
      const result = await login({
        email: s.user.email,
        password: creds.password,
        requiredRole: "owner",
        activationCredential: creds.credential,
      });
      assert.equal(
        jwt.verify(result.token, process.env.JWT_SECRET).purpose,
        "activation",
      );
      await assert.rejects(
        middleware(protect, {
          headers: {
            authorization: `Bearer ${result.token}`,
          },
          originalUrl: "/api/businesses/mine",
          method: "GET",
        }),
        /Complete invitation/,
      );
    },
  );
  await t.test(
    "existing email OTP activates invitation and starts 24-hour clock",
    async (t) => {
      const s = await approved(t);
      t.mock.method(Otp, "findOne", async () => ({
        _id: "otp",
        otp: "123456",
        attempts: 0,
        expiresAt: new Date(Date.now() + 60000),
        ownerTokenVersion: s.user.tokenVersion,
      }));
      t.mock.method(Otp, "deleteOne", async () => {});
      const result = await verifyEmailVerificationOtp({
        email: s.user.email,
        otp: "123456",
        userId: uid,
        ownerTokenVersion: s.user.tokenVersion,
      });
      assert.equal(result.user.ownerAccess.status, "ACTIVE");
      assert.equal(
        s.user.ownerAccess.passwordChangeDeadline -
          s.user.ownerAccess.firstLoginAt,
        PASSWORD_CHANGE_MS,
      );
      assert.equal(s.user.ownerAccess.activationTokenHash, undefined);
      assert.ok(s.application.invitation.activatedAt);
    },
  );
  await t.test("activation succeeds just before five hours", async (t) => {
    const s = await approved(t),
      now = new Date(s.user.ownerAccess.invitationExpiresAt.getTime() - 1);
    await activateOwner(s.user, now);
    assert.equal(s.user.ownerAccess.firstLoginAt.getTime(), now.getTime());
  });
  await t.test(
    "activation is denied at the exact five-hour boundary",
    async (t) => {
      const s = await approved(t),
        now = s.user.ownerAccess.invitationExpiresAt;
      assert.equal(ownerState(s.user, now.getTime()), "EXPIRED");
      await assert.rejects(activateOwner(s.user, now), /expired/);
      assert.equal(s.user.ownerAccess.status, "INVITED");
    },
  );
  await t.test(
    "consumed credentials and concurrent activation are rejected",
    async (t) => {
      const s = await approved(t),
        creds = invitation(s),
        snapshot = {
          ...s.user,
        };
      const results = await Promise.allSettled([
        activateOwner(snapshot),
        activateOwner(snapshot),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      await assert.rejects(
        validateInvitation(s.user, creds.credential),
        /invalid or expired/,
      );
    },
  );
  await t.test("old OTP cannot activate reissued invitation", async (t) => {
    const s = await approved(t),
      version = s.user.tokenVersion;
    await reviewApplication(id, actor, "reissue");
    t.mock.method(Otp, "findOne", async () => ({
      otp: "123456",
      attempts: 0,
      expiresAt: new Date(Date.now() + 60000),
      ownerTokenVersion: version,
    }));
    await assert.rejects(
      verifyEmailVerificationOtp({
        email: s.user.email,
        otp: "123456",
        userId: uid,
        ownerTokenVersion: s.user.tokenVersion,
      }),
      /Invitation changed/,
    );
  });
  await t.test(
    "password replacement requires current password, strength and non-reuse",
    async (t) => {
      const s = await approved(t),
        creds = invitation(s);
      await activateOwner(s.user);
      await assert.rejects(
        changeOwnerPassword(uid, "incorrect", "NewPassword!123"),
        /incorrect/,
      );
      await assert.rejects(
        changeOwnerPassword(uid, creds.password, "weak"),
        /8–128/,
      );
      await assert.rejects(
        changeOwnerPassword(uid, creds.password, creds.password),
        /different/,
      );
      const previous = s.user.tokenVersion;
      await changeOwnerPassword(uid, creds.password, "MyNewPassword!123");
      assert.equal(s.user.ownerAccess.mustChangePassword, false);
      assert.equal(
        await comparePassword(creds.password, s.user.password),
        false,
      );
      assert.equal(s.user.tokenVersion, previous + 1);
    },
  );
  await t.test(
    "24-hour boundary blocks operations but allows password recovery screen",
    async (t) => {
      const s = await approved(t);
      await activateOwner(s.user);
      s.user.ownerAccess.passwordChangeDeadline = new Date(Date.now() - 1);
      assert.equal(ownerState(s.user), "PASSWORD_REQUIRED");
      const token = generateToken(s.user),
        headers = {
          authorization: `Bearer ${token}`,
        };
      await assert.rejects(
        middleware(protect, {
          headers,
          originalUrl: "/api/businesses/mine",
          method: "GET",
        }),
        /Password change required/,
      );
      await middleware(protect, {
        headers,
        originalUrl: "/api/auth/me",
        method: "GET",
      });
    },
  );
  await t.test(
    "account security remains available when a business is suspended",
    async (t) => {
      const store = await approved(t);
      await activateOwner(store.user);
      store.hub = null;
      const headers = { authorization: `Bearer ${generateToken(store.user)}` };
      await middleware(protect, {
        headers,
        originalUrl: "/api/auth/me",
        method: "GET",
      });
      await assert.rejects(
        middleware(protect, {
          headers,
          originalUrl: "/api/businesses/mine",
          method: "GET",
        }),
        /Business approval/,
      );
    },
  );
  await t.test("replaced password invalidates previous sessions", async (t) => {
    const s = await approved(t),
      creds = invitation(s);
    await activateOwner(s.user);
    const token = generateToken(s.user);
    await changeOwnerPassword(uid, creds.password, "MyNewPassword!123");
    await assert.rejects(
      middleware(protect, {
        headers: {
          authorization: `Bearer ${token}`,
        },
        originalUrl: "/api/auth/me",
        method: "GET",
      }),
      {
        statusCode: 401,
      },
    );
  });
  await t.test(
    "public owner and admin signup are forbidden including Google",
    async (t) => {
      const s = fixture(t);
      for (const role of ["owner", "admin", "HUB_OWNER", "SUPER_ADMIN"])
        await assert.rejects(
          register({
            ...input,
            name: input.ownerName,
            password: "SecurePass!123",
            role,
          }),
          {
            statusCode: 403,
          },
        );
      await assert.rejects(
        findOrCreateGoogleUser({
          email: input.email,
          googleId: "abc",
          name: "Asha",
          role: "owner",
        }),
        {
          statusCode: 403,
        },
      );
      assert.equal(s.createdUsers, 0);
    },
  );
  await t.test(
    "customer password authentication remains unchanged",
    async (t) => {
      const s = fixture(t);
      s.user = {
        _id: uid,
        email: "customer@example.com",
        name: "Customer",
        role: "customer",
        password: await hashPassword("SecurePass!123"),
      };
      const result = await login({
        email: s.user.email,
        password: "SecurePass!123",
        requiredRole: "customer",
      });
      assert.equal(result.user.role, "customer");
      assert.equal(
        jwt.verify(result.token, process.env.JWT_SECRET).purpose,
        "session",
      );
    },
  );
  await t.test(
    "existing owners retain access with no migration required",
    async (t) => {
      fixture(t);
      assert.equal(
        ownerState({
          role: "owner",
        }),
        "ACTIVE",
      );
      assert.equal(
        ownerState({
          role: "owner",
          ownerAccess: {
            mustChangePassword: false,
          },
        }),
        "ACTIVE",
      );
    },
  );
  await t.test(
    "legacy owners without a persisted token version can change passwords",
    async (t) => {
      const store = fixture(t);
      store.user = {
        _id: uid,
        role: "owner",
        password: await hashPassword("OldPassword!123"),
      };
      const update = User.findOneAndUpdate;
      t.mock.method(User, "findOneAndUpdate", (filter, values) => {
        assert.deepEqual(filter.$or, [
          { tokenVersion: 0 },
          { tokenVersion: { $exists: false } },
        ]);
        return update(filter, values);
      });
      await changeOwnerPassword(uid, "OldPassword!123", "NewPassword!123");
      assert.equal(store.user.tokenVersion, 1);
      assert.equal(
        await comparePassword("NewPassword!123", store.user.password),
        true,
      );
    },
  );
  await t.test(
    "profile cannot assign approval, verification, password or role",
    async (t) => {
      const s = fixture(t);
      s.user = {
        _id: uid,
        email: "customer@example.com",
        role: "customer",
        isEmailVerified: false,
        save: async () => {},
      };
      await updateProfile(uid, {
        role: "admin",
        isEmailVerified: true,
        password: "hacked",
        tokenVersion: 99,
        ownerAccess: {
          status: "ACTIVE",
        },
        subscription: {
          plan: "PRO",
        },
      });
      assert.equal(s.user.role, "customer");
      assert.equal(s.user.isEmailVerified, false);
      assert.equal(s.user.ownerAccess, undefined);
      assert.equal(s.user.subscription, undefined);
    },
  );
  await t.test(
    "cross-business update denied and existing draft reused during onboarding",
    async (t) => {
      const s = await approved(t);
      const draft = s.hub;
      const result = await initOnboarding(uid);
      assert.equal(result._id, hid);
      assert.equal(s.createdHubs, 1);
      t.mock.method(Business, "findOne", () => query(null));
      await assert.rejects(
        updateBusiness(hid, "different-owner", {
          name: "Changed",
        }),
        /not found|not authorized/i,
      );
      assert.equal(draft.name, input.businessName);
    },
  );
  await t.test(
    "admin reissue replaces expired invitation with a fresh five-hour window",
    async (t) => {
      const s = await approved(t),
        old = s.user.ownerAccess.activationTokenHash;
      s.user.ownerAccess.status = "EXPIRED";
      const now = new Date("2030-01-01T10:00:00Z");
      await reviewApplication(
        id,
        actor,
        "reissue",
        "Owner requested new invite",
        now,
      );
      assert.equal(s.user.ownerAccess.status, "INVITED");
      assert.equal(
        s.user.ownerAccess.invitationExpiresAt.toISOString(),
        "2030-01-01T15:00:00.000Z",
      );
      assert.notEqual(s.user.ownerAccess.activationTokenHash, old);
      assert.equal(s.createdUsers, 1);
    },
  );
  await t.test(
    "password reset cannot bypass invitation activation",
    async (t) => {
      const s = await approved(t);
      t.mock.method(Otp, "findOne", async () => ({
        _id: "reset",
        verified: true,
        expiresAt: new Date(Date.now() + 100000),
      }));
      await assert.rejects(
        resetPassword({
          rawEmail: s.user.email,
          resetToken: "valid",
          newPassword: "SecureNewPass!123",
        }),
        /Complete invitation/,
      );
    },
  );
  await t.test(
    "managed owner cannot create another draft after completing onboarding",
    async (t) => {
      const store = await approved(t);
      store.hub.onboarding.status = "COMPLETED";
      store.hub.category = "clinic";
      store.user.businessCategories = ["clinic"];
      t.mock.method(Application, "findOne", () => query(store.application));
      let result;
      let failure;
      const response = {
        status() {
          return this;
        },
        json(data) {
          result = data;
        },
      };
      await initOnboardingHandler(
        { user: store.user, body: {} },
        response,
        (error) => {
          failure = error;
        },
      );
      assert.equal(failure, undefined);
      assert.equal(result.data.business._id, hid);
      assert.equal(store.createdHubs, 1);
    },
  );
  await t.test(
    "recovery replaces an overdue temporary password and invalidates sessions",
    async (t) => {
      const store = await approved(t);
      await activateOwner(store.user);
      store.user.ownerAccess.passwordChangeDeadline = new Date(Date.now() - 1);
      t.mock.method(Otp, "findOne", async () => ({
        _id: "reset",
        verified: true,
        expiresAt: new Date(Date.now() + 10000),
      }));
      t.mock.method(Otp, "deleteMany", async () => {});
      const version = store.user.tokenVersion;
      await resetPassword({
        rawEmail: store.user.email,
        resetToken: "test-reset",
        newPassword: "RecoveredPassword!123",
      });
      assert.equal(store.user.ownerAccess.mustChangePassword, false);
      assert.equal(store.user.tokenVersion, version + 1);
    },
  );
  await t.test("cookie-only cross-site writes are rejected", () => {
    let status,
      next = false;
    cookieOriginGuard(
      {
        method: "POST",
        cookies: {
          token: "cookie",
        },
        headers: {
          origin: "https://attacker.example",
        },
      },
      {
        status(code) {
          status = code;
          return this;
        },
        json() {},
      },
      () => {
        next = true;
      },
    );
    assert.equal(status, 403);
    assert.equal(next, false);
  });
});
