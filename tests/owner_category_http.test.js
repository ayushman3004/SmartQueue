import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../src/modules/auth/auth.model.js';
import Queue from '../src/queue/queue.model.js';
import Business from '../src/modules/business/business.model.js';
import routes from '../src/modules/business/business.routes.js';

test('owner category choice persists, filters venues, and requires admin for further grants', async t => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'owner-category-integration-test';
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  const owner = { _id: 'owner', role: 'owner', isEmailVerified: true, businessCategories: [], subscription: { status: 'ACTIVE', plan: 'BASIC' } };
  const admin = { _id: 'admin', role: 'admin' };
  t.mock.method(User, 'findById', id => ({ select: async () => id === 'admin' ? admin : owner }));
  t.mock.method(User, 'findOneAndUpdate', async (query, update) => {
    if (query.businessCategories && owner.businessCategories.includes('clinic')) return null;
    Object.assign(owner, update.$set);
    return owner;
  });
  t.mock.method(Business, 'find', async () => [{ _id: 'clinic-venue', category: 'clinic' }, { _id: 'salon-venue', category: 'salon' }]);
  t.mock.method(Business, 'findOne', async () => ({ _id: 'existing-clinic', owner: 'owner', category: 'clinic', approvalStatus: 'approved' }));
  const created = [];
  t.mock.method(Business, 'exists', async () => ({ _id: 'existing-clinic' }));
  t.mock.method(Business, 'create', async data => {
    const business = { ...data, _id: `new-hub-${created.length}`, async save() { return this; } };
    created.push(business);
    return business;
  });
  t.mock.method(Queue, 'findOne', async () => ({ _id: 'queue' }));
  const app = express();
  app.use(express.json());
  app.use('/api/businesses', routes);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const request = (path, method = 'GET', body, who = 'owner') => fetch(`http://127.0.0.1:${server.address().port}/api/businesses${path}`, {
    method, headers: { Authorization: `Bearer ${jwt.sign({ id: who }, process.env.JWT_SECRET)}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body),
  });
  assert.equal((await request('/owner-category', 'POST', { category: 'clinic' })).status, 200);
  assert.deepEqual((await (await request('/owner-category')).json()).data.categories, ['clinic']);
  assert.deepEqual((await (await request('/accessible')).json()).data.businesses.map(b => b._id), ['clinic-venue']);
  assert.deepEqual((await (await request('/mine')).json()).data.businesses.map(b => b._id), ['clinic-venue']);
  // An activated applicant can add locations without changing their approved industry.
  owner.ownerAccess = { status: 'ACTIVE', applicationId: 'approved-application' };
  for (const path of ['', '/onboarding/init']) {
    const payload = { name: 'Second Clinic', createNew: true };
    const response = await request(path, 'POST', payload);
    assert.equal(response.status, 201, await response.text());
    assert.equal(created.at(-1).category, 'clinic');
    assert.ok(created.at(-1).categorySelectedAt);
    const count = created.length;
    assert.equal((await request(path, 'POST', { ...payload, category: 'salon' })).status, 403);
    assert.equal(created.length, count);
    owner.isEmailVerified = false;
    assert.equal((await request(path, 'POST', payload)).status, 403);
    assert.equal(created.length, count);
    owner.isEmailVerified = true;
  }
  assert.equal((await request('/owner-category', 'POST', { category: 'salon' })).status, 400);
  assert.equal((await request('/owner-category/owner', 'PUT', { categories: ['clinic', 'salon'] })).status, 403);
  assert.equal((await request('/owner-category/owner', 'PUT', { categories: ['clinic', 'salon'] }, 'admin')).status, 400);
  assert.equal((await (await request('/accessible')).json()).data.businesses.length, 1);
});
