import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import Application from '../src/modules/business-application/business-application.model.js';
import User from '../src/modules/auth/auth.model.js';
import Business from '../src/modules/business/business.model.js';
import { deleteApplication, submitApplication, resendApplicationAcknowledgement } from '../src/modules/business-application/business-application.service.js';

const id = '111111111111111111111111';
const ownerId = '222222222222222222222222';
const actor = { _id: '333333333333333333333333', role: 'admin' };
const input = { businessName: 'Test Clinic', ownerName: 'Owner', email: 'owner@example.com', phone: '9999999999', businessCategory: 'clinic', businessAddress: 'Main Street', city: 'City', description: 'A clinic', privacyAcknowledged: true };

test('reset revokes linked access, keeps history, and frees email for a fresh application', async t => {
  let application = { _id: id, ...input, status: 'APPROVED', linkedUserId: ownerId };
  const oldOwner = { email: input.email, tokenVersion: 0 };
  const session = {};
  t.mock.method(mongoose.connection, 'transaction', callback => callback(session));
  t.mock.method(Application, 'findOneAndUpdate', async (query, update, options) => {
    assert.equal(options.session, session);
    if (application.status === 'DELETED') return null;
    assert.equal(update.$push.audit.actor, actor._id);
    Object.assign(application, update.$set);
    return application;
  });
  t.mock.method(User, 'findOneAndUpdate', async (query, update, options) => {
    assert.equal(options.session, session);
    assert.equal(query['ownerAccess.applicationId'], id);
    assert.equal(update.$set['ownerAccess.status'], 'SUSPENDED');
    assert.equal(update.$unset['ownerAccess.activationTokenHash'], 1);
    oldOwner.email = update.$set.email;
    oldOwner.tokenVersion += update.$inc.tokenVersion;
    return oldOwner;
  });
  let closed = false;
  t.mock.method(Business, 'updateMany', async (query, update, options) => {
    assert.equal(options.session, session);
    assert.equal(query.owner, ownerId);
    assert.deepEqual(update.$set, { isActive: false, isOpen: false });
    closed = true;
  });
  await assert.rejects(deleteApplication(id, { role: 'owner' }), /Administrator/);
  await deleteApplication(id, actor);
  assert.equal(application.status, 'DELETED');
  assert.equal(application.email, input.email);
  assert.notEqual(oldOwner.email, input.email);
  assert.equal(oldOwner.tokenVersion, 1);
  assert.equal(closed, true);
  await assert.rejects(deleteApplication(id, actor), /already deleted/);
  t.mock.method(Application, 'create', async data => {
    assert.equal(application.status, 'DELETED');
    application = { _id: id, status: 'PENDING', ...data };
    return application;
  });
  t.mock.method(Application, 'updateOne', async (_query, update) => Object.assign(application, update.$set));
  const previous = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 'test-only';
  t.after(() => { if (previous === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = previous; });
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ id: 'mock' }) }));
  await submitApplication(input);
  assert.equal(application.status, 'PENDING');
  assert.equal(application.acknowledgement.delivery, 'SENT');
});

test('acknowledgement failure is recorded and admins can retry', async t => {
  const application = { _id: id, ...input, status: 'PENDING', toObject() { return { ...this }; } };
  const previous = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 'test-only';
  t.after(() => { if (previous === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = previous; });
  t.mock.method(Application, 'findById', async () => application);
  t.mock.method(Application, 'updateOne', async (_query, update) => Object.assign(application, update.$set));
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ id: 'mock' }) }));
  await assert.rejects(resendApplicationAcknowledgement(id, { role: 'owner' }), /Administrator/);
  const smtpEnvironment = { SMTP_USER: process.env.SMTP_USER, SMTP_PASS: process.env.SMTP_PASS };
  process.env.SMTP_USER = 'mock-user';
  process.env.SMTP_PASS = 'mock-pass';
  t.after(() => { for (const [key, value] of Object.entries(smtpEnvironment)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  t.mock.method(nodemailer, 'createTransport', () => ({ sendMail: async () => { throw new Error('mock SMTP failure'); } }));
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 503, json: async () => ({}) }));
  const failed = await resendApplicationAcknowledgement(id, actor);
  assert.equal(failed.acknowledgement.delivery, 'FAILED');
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ id: 'mock' }) }));
  const result = await resendApplicationAcknowledgement(id, actor);
  assert.equal(result.acknowledgement.delivery, 'SENT');
  application.status = 'DELETED';
  await assert.rejects(resendApplicationAcknowledgement(id, actor), /not found/);
});
