import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Notification from '../src/modules/notification/notification.model.js';
import Queue from '../src/queue/queue.model.js';
import Business from '../src/modules/business/business.model.js';
import { createNotification, listNotifications, markNotificationRead, markAllNotificationsRead, notifyUser, safeNotificationHref, turnNotificationPayload, notifyServingTurns } from '../src/modules/notification/notification.service.js';

const recipient = '507f1f77bcf86cd799439011';
const id = '507f1f77bcf86cd799439012';

test('turn alerts identify the patient and visit, survive queue reordering, and skip waiting users', async t => {
  const previousState = mongoose.connection._readyState;
  mongoose.connection._readyState = 1;
  t.after(() => { mongoose.connection._readyState = previousState; });
  const business = { _id: id, name: 'Test Clinic' };
  const entry = { _id: 'old-id', userId: recipient, joinedAt: '2026-11-21T10:00:00Z', status: 'serving', assignedStaff: { name: 'Dr. Demo' } };
  const payload = turnNotificationPayload(business, entry);
  assert.equal(payload.recipient, recipient);
  assert.equal(payload.title, 'It’s your turn!');
  assert.match(payload.message, /Dr. Demo.*Test Clinic/);
  assert.equal(payload.href, `/queue/${id}`);
  assert.equal(turnNotificationPayload(business, { ...entry, _id: 'new-id' }).eventKey, payload.eventKey);
  assert.notEqual(turnNotificationPayload(business, { ...entry, joinedAt: '2026-11-22T10:00:00Z' }).eventKey, payload.eventKey);
  const saved = [];
  t.mock.method(Notification, 'create', async data => { saved.push(data); return data; });
  await notifyServingTurns(business, [entry, { ...entry, userId: 'someone-else', status: 'waiting' }]);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].recipient, recipient);
});

test('opening the inbox recovers an already active turn only for the signed-in patient', async t => {
  const previousState = mongoose.connection._readyState;
  mongoose.connection._readyState = 1;
  t.after(() => { mongoose.connection._readyState = previousState; });
  const saved = [];
  t.mock.method(Queue, 'find', query => {
    assert.deepEqual(query.users.$elemMatch, { userId: recipient, status: 'serving' });
    return { select: () => ({ lean: async () => [{ businessId: id, users: [
      { userId: recipient, bookingId: 'visit', status: 'serving' },
      { userId: 'other-patient', bookingId: 'other-visit', status: 'serving' },
    ] }] }) };
  });
  t.mock.method(Business, 'find', () => ({ select: () => ({ lean: async () => [{ _id: id, name: 'Clinic' }] }) }));
  t.mock.method(Notification, 'create', async data => { saved.push(data); return data; });
  t.mock.method(Notification, 'find', () => ({ sort: () => ({ limit: () => ({ lean: async () => saved }) }) }));
  t.mock.method(Notification, 'countDocuments', async () => saved.length);
  const result = await listNotifications(recipient);
  assert.equal(result.notifications.length, 1);
  assert.equal(result.notifications[0].title, 'It’s your turn!');
  assert.equal(result.notifications[0].recipient, recipient);
});

test('notification creation persists, deduplicates events, and targets a private room', async t => {
  const events = [];
  const io = { to(room) { return { emit(event, value) { events.push({ room, event, value }); } }; } };
  const payload = { recipient, type: 'hub', title: 'Hub is live', message: 'Your clinic is ready.', href: '/hub/dashboard', eventKey: 'hub:live:123' };
  let saved;
  t.mock.method(Notification, 'create', async value => { saved = value; return { _id: id, ...value }; });
  await createNotification(payload, io);
  assert.equal(saved.recipient, recipient);
  assert.equal(events[0].room, `user:${recipient}`);
  assert.equal(events[0].event, 'notification:created');
  t.mock.method(Notification, 'create', async () => { throw Object.assign(new Error('duplicate'), { code: 11000 }); });
  assert.equal(await createNotification(payload, io), null);
  assert.equal(events.length, 1);
});

test('notification delivery failure does not fail the primary operation', async t => {
  const previousState = mongoose.connection._readyState;
  mongoose.connection._readyState = 1;
  t.after(() => { mongoose.connection._readyState = previousState; });
  t.mock.method(Notification, 'create', async () => { throw new Error('database temporarily unavailable'); });
  t.mock.method(console, 'error', () => {});
  assert.equal(await notifyUser({ recipient }), null);
});

test('notification destinations must stay within the app', () => {
  assert.equal(safeNotificationHref('/queue/123?category=clinic'), '/queue/123?category=clinic');
  for (const href of ['//external.example', 'https://external.example', '/\\external.example', '/\n/external.example', 'javascript:alert(1)', null]) {
    assert.equal(safeNotificationHref(href), '');
  }
});

test('inbox scopes listing, unread counts, and cursor pagination to the recipient', async t => {
  let findQuery;
  let countQuery;
  const rows = Array.from({ length: 21 }, (_, index) => ({ _id: String(index), recipient }));
  t.mock.method(Notification, 'find', query => {
    findQuery = query;
    return { sort(order) {
      assert.deepEqual(order, { _id: -1 });
      return { limit(limit) { assert.equal(limit, 21); return { lean: async () => rows }; } };
    } };
  });
  t.mock.method(Notification, 'countDocuments', async query => { countQuery = query; return 3; });
  const result = await listNotifications(recipient, { before: id, unread: 'true' });
  assert.deepEqual(findQuery, { recipient, readAt: null, _id: { $lt: id } });
  assert.deepEqual(countQuery, { recipient, readAt: null });
  assert.equal(result.notifications.length, 20);
  assert.equal(result.nextCursor, '19');
  assert.equal(result.unreadCount, 3);
  await assert.rejects(listNotifications(recipient, { before: 'bad-id' }), { statusCode: 400 });
});

test('read controls cannot modify another account and preserve original read times', async t => {
  let query;
  const original = { _id: id, recipient, readAt: new Date('2026-11-21T10:00:00Z') };
  t.mock.method(Notification, 'findOneAndUpdate', async value => { query = value; return null; });
  t.mock.method(Notification, 'findOne', async value => {
    assert.deepEqual(value, { _id: id, recipient });
    return original;
  });
  assert.equal(await markNotificationRead(recipient, id), original);
  assert.deepEqual(query, { _id: id, recipient, readAt: null });
  t.mock.method(Notification, 'findOne', async () => null);
  await assert.rejects(markNotificationRead(recipient, id), { statusCode: 404 });
  await assert.rejects(markNotificationRead(recipient, 'bad-id'), { statusCode: 400 });
  t.mock.method(Notification, 'updateMany', async (filter, update) => {
    assert.deepEqual(filter, { recipient, readAt: null });
    assert.ok(update.$set.readAt instanceof Date);
  });
  await markAllNotificationsRead(recipient);
});
