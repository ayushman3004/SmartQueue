import { hashPassword } from "../src/modules/auth.utils.js";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../src/modules/auth/auth.model.js";
import Business from "../src/modules/business/business.model.js";
import Otp from "../src/modules/auth/otp.model.js";
import Application from "../src/modules/business-application/business-application.model.js";
import createGatewayRouter from "../src/gateway/gateway.router.js";
import { gatewayErrorHandler } from "../src/gateway/gateway.middleware.js";
const ownerId = "507f1f77bcf86cd799439012",
  applicationId = "507f1f77bcf86cd799439011";
const query = (value) => ({
  select: async () => value,
  then(resolve, reject) {
    return Promise.resolve(value).then(resolve, reject);
  },
});
test("business admission HTTP boundaries", async (t) => {
  process.env.JWT_SECRET = "http-admission-test-key";
  const oldKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = "fake-delivery-key";
  t.after(() => {
    if (oldKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = oldKey;
  });
  const actualFetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", async (url, options) =>
    String(url).startsWith("https://api.resend.com/")
      ? { ok: true, json: async () => ({ id: "mock-email" }) }
      : actualFetch(url, options),
  );
  const owner = {
    _id: ownerId,
    name: "Owner",
    email: "owner@example.com",
    role: "owner",
    tokenVersion: 1,
    ownerAccess: {
      applicationId,
      status: "INVITED",
      invitationExpiresAt: new Date(Date.now() + 300000),
      mustChangePassword: true,
    },
  };
  t.mock.method(User, "findById", (id) =>
    query(
      id === ownerId
        ? owner
        : { _id: id, role: id === "admin" ? "admin" : "customer" },
    ),
  );
  t.mock.method(User, "findOne", () => query(null));
  t.mock.method(User, "create", () => {
    throw new Error("Public request must not provision an account");
  });
  t.mock.method(Business, "findOne", async () => ({
    _id: "hub",
    owner: ownerId,
    approvalStatus: "approved",
  }));
  t.mock.method(Application, "create", async (data) => ({
    _id: applicationId,
    ...data,
    status: "PENDING",
  }));
  const app = express();
  app.use(express.json(), cookieParser());
  app.use("/api", createGatewayRouter());
  app.use(gatewayErrorHandler);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = (id, version = 0, purpose = "session") =>
    jwt.sign({ id, tokenVersion: version, purpose }, process.env.JWT_SECRET);
  const request = (
    path,
    { body, authorization, cookie, method = "POST" } = {},
  ) =>
    fetch(base + "/api" + path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(authorization ? { authorization: `Bearer ${authorization}` } : {}),
        ...(cookie ? { cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  await t.test(
    "public submission succeeds without setting a session cookie",
    async () => {
      const response = await request("/business-applications", {
        body: {
          businessName: "HTTP Salon",
          ownerName: "Owner",
          email: "apply@example.com",
          phone: "9876543210",
          businessCategory: "salon",
          businessAddress: "12 Road",
          city: "Kolkata",
          description: "A salon",
          privacyAcknowledged: true,
        },
      });
      assert.equal(response.status, 202);
      assert.equal(response.headers.get("set-cookie"), null);
      assert.equal((await response.json()).success, true);
    },
  );
  await t.test("legacy local owner registration is forbidden", async () => {
    const response = await request("/auth/signup", {
      body: {
        name: "Owner",
        email: "blocked@example.com",
        password: "SecurePassword!123",
        role: "owner",
      },
    });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("set-cookie"), null);
  });
  await t.test(
    "approval endpoints reject unauthenticated customers and owners",
    async () => {
      for (const authorization of [
        undefined,
        token("customer"),
        token(ownerId, 1, "activation"),
      ]) {
        const response = await request(
          `/admin/applications/${applicationId}/approve`,
          { authorization, body: {} },
        );
        assert.equal(response.status, authorization ? 403 : 401);
      }
    },
  );
  await t.test(
    "an activation session can read itself but cannot modify profile or pay",
    async () => {
      const authorization = token(ownerId, 1, "activation");
      const me = await request("/auth/me", { method: "GET", authorization });
      assert.equal(me.status, 200);
      assert.equal((await me.json()).data.user.ownerAccess.status, "INVITED");
      for (const [path, method] of [
        ["/auth/me", "PATCH"],
        ["/subscriptions/create-order", "POST"],
        ["/businesses/mine", "GET"],
      ]) {
        const response = await request(path, {
          method,
          authorization,
          ...(method !== "GET"
            ? { body: { plan: "BASIC", ownerAccess: { status: "ACTIVE" } } }
            : {}),
        });
        assert.equal(response.status, 403);
      }
    },
  );
  await t.test(
    "correct invited-owner login requests activation code without issuing a session",
    async (t) => {
      owner.password = await hashPassword("TemporaryPassword!123");
      t.mock.method(User, "findOne", () => query(owner));
      const response = await request("/auth/signin", {
        body: {
          email: owner.email,
          password: "TemporaryPassword!123",
          requiredRole: "owner",
        },
      });
      assert.equal(response.status, 403);
      const result = await response.json();
      assert.equal(result.code, "OWNER_ACTIVATION_REQUIRED");
      assert.match(result.message, /activation code/);
      assert.equal(response.headers.get("set-cookie"), null);
      assert.equal(result.data?.token, undefined);
      assert.equal(owner.ownerAccess.status, "INVITED");
      const wrong = await request("/auth/signin", {
        body: {
          email: owner.email,
          password: "WrongPassword!123",
          requiredRole: "owner",
        },
      });
      assert.equal(wrong.status, 401);
      assert.equal((await wrong.json()).code, undefined);
    },
  );
  await t.test(
    "existing OTP verification exchanges restricted JWT for active session",
    async () => {
      t.mock.method(Otp, "findOne", async () => ({
        _id: "otp",
        otp: "123456",
        attempts: 0,
        ownerTokenVersion: 1,
        expiresAt: new Date(Date.now() + 10000),
      }));
      t.mock.method(Otp, "deleteOne", async () => {});
      t.mock.method(mongoose.connection, "transaction", async (callback) =>
        callback({}),
      );
      t.mock.method(User, "findOneAndUpdate", async (_filter, update) => {
        for (const [key, value] of Object.entries(update.$set)) {
          if (key.startsWith("ownerAccess."))
            owner.ownerAccess[key.slice(12)] = value;
          else owner[key] = value;
        }
        owner.tokenVersion += 1;
        return owner;
      });
      t.mock.method(Application, "updateOne", async () => ({
        modifiedCount: 1,
      }));
      const response = await request("/auth/email/verify-otp", {
        authorization: token(ownerId, 1, "activation"),
        body: { otp: "123456", email: "attacker@example.com" },
      });
      assert.equal(response.status, 200);
      const data = (await response.json()).data;
      assert.equal(data.user.email, "owner@example.com");
      assert.equal(data.user.ownerAccess.status, "ACTIVE");
      const claims = jwt.verify(data.token, process.env.JWT_SECRET);
      assert.equal(claims.purpose, "session");
      assert.equal(claims.tokenVersion, 2);
      assert.ok(response.headers.get("set-cookie"));
      assert.equal(data.activatedUser, undefined);
      assert.equal(data.user.password, undefined);
    },
  );
  await t.test(
    "cookie sessions cannot reuse a pre-activation token",
    async () => {
      const response = await request("/auth/me", {
        method: "GET",
        cookie: `token=${token(ownerId, 1, "activation")}`,
      });
      assert.equal(response.status, 401);
    },
  );
});
