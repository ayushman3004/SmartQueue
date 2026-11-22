import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../src/modules/auth/auth.model.js';
import Notification from '../src/modules/notification/notification.model.js';
import routes from '../src/modules/notification/notification.routes.js';

test('notification HTTP endpoints authenticate and isolate each inbox', async t => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'notification-http-test';
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  const ownerId = '507f1f77bcf86cd799439011';
  const notificationId = '507f1f77bcf86cd799439012';
  t.mock.method(User, 'findById', () => ({ select: async () => ({ _id: ownerId, role: 'customer' }) }));
  t.mock.method(Notification, 'find', query => {
    assert.equal(query.recipient, ownerId);
    return { sort: () => ({ limit: () => ({ lean: async () => [] }) }) };
  });
  t.mock.method(Notification, 'countDocuments', async query => { assert.equal(query.recipient, ownerId); return 0; });
  t.mock.method(Notification, 'findOneAndUpdate', async query => { assert.equal(query.recipient, ownerId); return null; });
  t.mock.method(Notification, 'findOne', async query => { assert.equal(query.recipient, ownerId); return null; });
  let markedAll = false;
  t.mock.method(Notification, 'updateMany', async query => { assert.deepEqual(query, { recipient: ownerId, readAt: null }); markedAll = true; });
  const app = express();
  app.use(express.json());
  app.use('/api/notifications', routes);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const request = (path = '', method = 'GET', authenticated = true) => fetch(`http://127.0.0.1:${server.address().port}/api/notifications${path}`, {
    method, headers: authenticated ? { Authorization: `Bearer ${jwt.sign({ id: ownerId }, process.env.JWT_SECRET)}` } : {},
  });
  assert.equal((await request('', 'GET', false)).status, 401);
  assert.equal((await request('/read-all', 'PATCH', false)).status, 401);
  const list = await request('?recipient=another-user');
  assert.equal(list.status, 200);
  assert.deepEqual((await list.json()).data, { notifications: [], unreadCount: 0, nextCursor: null });
  assert.equal((await request(`/${notificationId}/read`, 'PATCH')).status, 404);
  assert.equal((await request('/invalid-id/read', 'PATCH')).status, 400);
  assert.equal((await request('?before=invalid-id')).status, 400);
  assert.equal((await request('/read-all', 'PATCH')).status, 200);
  assert.equal(markedAll, true);
});
