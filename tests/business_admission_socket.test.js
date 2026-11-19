import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import User from "../src/modules/auth/auth.model.js";
import Business from "../src/modules/business/business.model.js";
import Booking from "../src/booking/booking.model.js";
import { initSocket } from "../realtime/socket.js";

test("socket authentication and business isolation", async (t) => {
  process.env.JWT_SECRET = "socket-admission-test";
  t.mock.method(globalThis, "setInterval", () => ({ unref() {} }));
  let authenticate, connect;
  const io = {
    use(fn) {
      authenticate = fn;
    },
    on(event, fn) {
      if (event === "connection") connect = fn;
    },
  };
  initSocket(io);
  let current = { _id: "111111111111111111111111", role: "owner", tokenVersion: 0 };
  t.mock.method(User, "findById", async () => current);
  const socket = {
    id: "socket-admission",
    handshake: {
      auth: {
        token: jwt.sign(
          { id: "111111111111111111111111", tokenVersion: 0 },
          process.env.JWT_SECRET,
        ),
      },
      headers: {},
    },
    user: null,
    on() {},
  };
  await t.test(
    "invited owner cannot connect using a restricted activation token",
    async () => {
      current = {
        ...current,
        ownerAccess: {
          applicationId: "application",
          status: "INVITED",
          invitationExpiresAt: new Date(Date.now() + 10000),
        },
      };
      let error;
      await authenticate(socket, (value) => {
        error = value;
      });
      assert.match(error.message, /activation/);
    },
  );
  await t.test(
    "stale tokens are rejected using current database version",
    async () => {
      current = { _id: "111111111111111111111111", role: "owner", tokenVersion: 1 };
      let error;
      await authenticate(socket, (value) => {
        error = value;
      });
      assert.match(error.message, /activation or password change/);
    },
  );
  await t.test(
    "active owner cannot join a foreign booking private room",
    async () => {
      current = { _id: "111111111111111111111111", role: "owner", tokenVersion: 0 };
      let error;
      await authenticate(socket, (value) => {
        error = value;
      });
      assert.equal(error, undefined);
      const handlers = new Map(),
        rooms = [],
        errors = [];
      socket.on = (event, fn) => handlers.set(event, fn);
      socket.join = (room) => rooms.push(room);
      socket.emit = (_event, data) => errors.push(data);
      connect(socket);
      t.mock.method(Booking, "findById", async () => ({
        userId: "other-customer",
        businessId: "foreign-hub",
      }));
      t.mock.method(Business, "findOne", async () => null);
      await handlers.get("join:booking")({ bookingId: "222222222222222222222222" });
      assert.equal(rooms.includes("booking:222222222222222222222222"), false);
      assert.match(errors.at(-1).message, /Access denied/);
      t.mock.method(Business, "findOne", async () => ({ _id: "own-hub" }));
      await handlers.get("join:booking")({ bookingId: "333333333333333333333333" });
      assert.equal(rooms.includes("booking:333333333333333333333333"), true);
    },
  );
});
