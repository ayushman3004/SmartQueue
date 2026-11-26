import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import Queue from "../src/queue/queue.model.js";
import Business from "../src/modules/business/business.model.js";
import User from "../src/modules/auth/auth.model.js";
import Review from "../src/modules/review/review.model.js";
import queueRoutes from "../src/queue/queue.routes.js";
import businessRoutes from "../src/modules/business/business.routes.js";
import { publishQueue } from "../src/queue/queue.view.js";

test("queue and clinic discovery expose only the signed-in patient's own visit details", async t => {
  process.env.JWT_SECRET = "queue-privacy-test-key";
  const person = { _id: "111111111111111111111111", role: "customer" };
  const other = { _id: "222222222222222222222222", role: "customer" };
  const owner = { _id: "333333333333333333333333", role: "owner", businessCategories: ["clinic"] };
  const otherOwner = { _id: "444444444444444444444444", role: "owner", businessCategories: ["clinic"] };
  const clinicId = "555555555555555555555555";
  const row = {
    _id: "queue-entry",
    userId: { _id: person._id, name: "Fixture Patient", email: "fixture@example.test", phone: "+910000000000" },
    bookingId: "private-booking",
    status: "serving",
    serviceTime: 15,
    serviceType: "private-service",
    paidAmount: 1250,
    paymentStatus: "paid",
    joinedAt: new Date(),
    estimatedStartTime: new Date(),
    assignedStaff: { name: "Dr Fixture", role: "Doctor", staffId: "staff-id" },
  };
  const business = {
    _id: clinicId, owner: owner._id, category: "clinic", approvalStatus: "approved",
    subscription: { status: "ACTIVE", plan: "BASIC" },
  };
  const queue = { _id: "queue-id", businessId: clinicId, users: [row], populate: async () => ({ businessId: clinicId, users: [row] }) };
  t.mock.method(User, "findById", id => ({ select: async () => [person, other, owner, otherOwner].find(user => user._id === id) }));
  t.mock.method(Queue, "findOne", async () => queue);
  t.mock.method(Business, "findById", () => {
    const detail = { ...business, toObject: () => ({ ...business }) };
    return { then: resolve => Promise.resolve(detail).then(resolve), populate: async () => detail };
  });
  t.mock.method(Business, "aggregate", async () => [{ ...business, activeQueue: [row] }]);
  t.mock.method(Business, 'countDocuments', async () => 0);
  t.mock.method(Review, "find", () => ({ select: async () => [] }));

  const app = express();
  app.use("/api/queue", queueRoutes);
  app.use("/api/businesses", businessRoutes);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const get = async (path, user) => {
    const authorization = user && `Bearer ${jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" })}`;
    const result = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { headers: authorization ? { authorization } : {} });
    assert.equal(result.status, 200);
    assert.match(result.headers.get("cache-control"), /no-store/);
    return (await result.json()).data;
  };

  const queuePath = `/api/queue/${clinicId}`;
  const businessPath = `/api/businesses/${clinicId}`;
  const listPath = "/api/businesses";
  const anonymous = {
    status: "serving", serviceTime: 15, estimatedStartTime: row.estimatedStartTime.toISOString(),
    assignedStaff: { name: "Dr Fixture", role: "Doctor" },
  };
  for (const viewer of [undefined, other, otherOwner]) {
    assert.deepEqual((await get(queuePath, viewer)).queue.users, [anonymous]);
    assert.deepEqual((await get(businessPath, viewer)).business.activeQueue, [anonymous]);
    assert.deepEqual((await get(listPath, viewer)).businesses[0].activeQueue, [anonymous]);
  }
  for (const rows of [
    (await get(queuePath, person)).queue.users,
    (await get(businessPath, person)).business.activeQueue,
    (await get(listPath, person)).businesses[0].activeQueue,
  ]) {
    assert.equal(rows[0].userId, person._id);
    assert.equal(rows[0].bookingId, row.bookingId);
    assert.equal(rows[0].paidAmount, row.paidAmount);
  }
  const [ownerRow] = (await get(queuePath, owner)).queue.users;
  assert.deepEqual(ownerRow.userId, { _id: person._id, name: row.userId.name });
  assert.equal(ownerRow.bookingId, undefined);
  assert.equal(ownerRow.serviceType, undefined);
  business.approvalStatus = "suspended";
  assert.deepEqual((await get(queuePath, owner)).queue.users, [anonymous]);

  const events = [];
  publishQueue({ to: room => ({ emit: (event, payload) => events.push({ room, event, payload }) }) }, clinicId, queue);
  assert.equal(events.length, 2);
  for (const { room, payload } of events) {
    assert.equal(room, `business:${clinicId}`);
    assert.deepEqual(JSON.parse(JSON.stringify(payload.queue || payload)).users, [anonymous]);
  }
});
