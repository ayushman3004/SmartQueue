import test from "node:test";
import assert from "node:assert/strict";
import User from "../src/modules/auth/auth.model.js";
import { findOrCreateGoogleUser } from "../src/modules/auth/auth.service.js";

test("Google Auth - Role Selection & User Creation", async (t) => {
  const originalFindOne = User.findOne;
  const originalCreate = User.create;

  t.afterEach(() => {
    User.findOne = originalFindOne;
    User.create = originalCreate;
  });

  await t.test("creates new user as owner when role is owner", async () => {
    let createdPayload = null;
    User.findOne = async () => null;
    User.create = async (payload) => {
      createdPayload = payload;
      return { ...payload, _id: "user-owner-123" };
    };

    const user = await findOrCreateGoogleUser({
      googleId: "google-111",
      email: "owner@example.com",
      name: "Owner John",
      avatar: "https://avatar.com/1",
      role: "owner",
    });

    assert.equal(createdPayload.role, "owner");
    assert.equal(createdPayload.googleId, "google-111");
    assert.equal(user.role, "owner");
  });

  await t.test("creates new user as customer when role is customer or unspecified", async () => {
    let createdPayload = null;
    User.findOne = async () => null;
    User.create = async (payload) => {
      createdPayload = payload;
      return { ...payload, _id: "user-cust-123" };
    };

    const user = await findOrCreateGoogleUser({
      googleId: "google-222",
      email: "cust@example.com",
      name: "Customer Jane",
      avatar: "https://avatar.com/2",
      role: "customer",
    });

    assert.equal(createdPayload.role, "customer");
    assert.equal(user.role, "customer");
  });

  await t.test("upgrades existing customer account to owner when owner role is selected", async () => {
    const existingUser = {
      _id: "user-333",
      googleId: "google-333",
      email: "switch@example.com",
      role: "customer",
      saved: false,
      save: async function () {
        this.saved = true;
      },
    };

    User.findOne = async ({ googleId }) => {
      if (googleId === "google-333") return existingUser;
      return null;
    };

    const user = await findOrCreateGoogleUser({
      googleId: "google-333",
      email: "switch@example.com",
      name: "Switch User",
      role: "owner",
    });

    assert.equal(user.role, "owner");
    assert.equal(existingUser.saved, true);
  });

  await t.test("does not demote existing owner account to customer", async () => {
    const existingOwner = {
      _id: "user-444",
      googleId: "google-444",
      email: "alreadyowner@example.com",
      role: "owner",
      saved: false,
      save: async function () {
        this.saved = true;
      },
    };

    User.findOne = async ({ googleId }) => {
      if (googleId === "google-444") return existingOwner;
      return null;
    };

    const user = await findOrCreateGoogleUser({
      googleId: "google-444",
      email: "alreadyowner@example.com",
      name: "Already Owner",
      role: "customer",
    });

    assert.equal(user.role, "owner");
    assert.equal(existingOwner.saved, false);
  });
});
