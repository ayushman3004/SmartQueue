import test from "node:test";
import assert from "node:assert/strict";
import User from "../src/modules/auth/auth.model.js";
import { login, register, EMAIL_REGEX } from "../src/modules/auth/auth.service.js";
import { hashPassword } from "../src/modules/auth.utils.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-key-123";

test("Auth Role & Validation Flow - Cross-Role Login Checks & Security", async (t) => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;

  t.afterEach(() => {
    User.findOne = originalFindOne;
    User.create = originalCreate;
  });

  await t.test("Validates email regex strictly", () => {
    assert.equal(EMAIL_REGEX.test("valid.user+1@domain.com"), true);
    assert.equal(EMAIL_REGEX.test("user@sub.domain.co"), true);
    assert.equal(EMAIL_REGEX.test("invalid-email"), false);
    assert.equal(EMAIL_REGEX.test("invalid@"), false);
    assert.equal(EMAIL_REGEX.test("invalid@domain"), false);
    assert.equal(EMAIL_REGEX.test("@domain.com"), false);
    assert.equal(EMAIL_REGEX.test("space in@domain.com"), false);
  });

  await t.test("Rejects register if password lacks numbers, capital letters, or symbols", async () => {
    // Too short
    await assert.rejects(
      () => register({ name: "Alex", email: "alex@example.com", password: "Ab1!", role: "customer" }),
      /at least 8 characters/
    );

    // No capital letter
    await assert.rejects(
      () => register({ name: "Alex", email: "alex@example.com", password: "password123!", role: "customer" }),
      /capital letter/
    );

    // No number
    await assert.rejects(
      () => register({ name: "Alex", email: "alex@example.com", password: "Password!@#", role: "customer" }),
      /number/
    );

    // No symbol
    await assert.rejects(
      () => register({ name: "Alex", email: "alex@example.com", password: "Password1234", role: "customer" }),
      /special symbol/
    );
  });

  await t.test("Rejects customer trying to login as Hub Owner", async () => {
    const hashedPassword = await hashPassword("ValidPass123!");
    User.findOne = () => ({
      select: async () => ({
        _id: "user-cust-1",
        email: "customer@serveq.tech",
        role: "customer",
        password: hashedPassword,
      }),
    });

    await assert.rejects(
      () => login({ email: "customer@serveq.tech", password: "ValidPass123!", requiredRole: "owner" }),
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /Access restricted to Hub Owners/);
        assert.match(err.message, /registered as a Customer/);
        return true;
      }
    );
  });

  await t.test("Rejects Hub Owner trying to login as Customer (vice versa)", async () => {
    const hashedPassword = await hashPassword("ValidPass123!");
    User.findOne = () => ({
      select: async () => ({
        _id: "user-owner-1",
        email: "owner@serveq.tech",
        role: "owner",
        password: hashedPassword,
      }),
    });

    await assert.rejects(
      () => login({ email: "owner@serveq.tech", password: "ValidPass123!", requiredRole: "customer" }),
      (err) => {
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /Access restricted to Customers/);
        assert.match(err.message, /registered as a Hub Owner/);
        return true;
      }
    );
  });

  await t.test("Allows legitimate Customer to login as Customer and Hub Owner as Hub Owner", async () => {
    const hashedPassword = await hashPassword("ValidPass123!");

    // Customer login
    User.findOne = () => ({
      select: async () => ({
        _id: "user-cust-2",
        name: "Customer Dave",
        email: "dave@example.com",
        role: "customer",
        password: hashedPassword,
      }),
    });
    const custResult = await login({ email: "dave@example.com", password: "ValidPass123!", requiredRole: "customer" });
    assert.equal(custResult.user.role, "customer");
    assert.ok(custResult.token);

    // Hub Owner login
    User.findOne = () => ({
      select: async () => ({
        _id: "user-owner-2",
        name: "Owner Sarah",
        email: "sarah@example.com",
        role: "owner",
        password: hashedPassword,
      }),
    });
    const ownerResult = await login({ email: "sarah@example.com", password: "ValidPass123!", requiredRole: "owner" });
    assert.equal(ownerResult.user.role, "owner");
    assert.ok(ownerResult.token);
  });
});
