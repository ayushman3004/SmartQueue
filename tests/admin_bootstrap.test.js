import test from 'node:test';
import assert from 'node:assert/strict';
import User from '../src/modules/auth/auth.model.js';
import { login, register } from '../src/modules/auth/auth.service.js';
import { hashPassword } from '../src/modules/auth.utils.js';

function legacyConfiguration(t) {
  for (const [key, value] of Object.entries({
    ADMIN_EMAIL: 'legacy-admin@example.com',
    ADMIN_PASSWORD: 'BootstrapOnly!123',
    JWT_SECRET: 'test-only-admin-auth-secret',
  })) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
}

test('configured administrator credentials cannot create an account through sign-in', async (t) => {
  legacyConfiguration(t);
  t.mock.method(User, 'findOne', () => ({ select: async () => null }));
  const create = t.mock.method(User, 'create', async () => { throw new Error('Sign-in must not create accounts'); });
  for (const requiredRole of [undefined, 'customer', 'admin']) {
    await assert.rejects(login({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, requiredRole }), { statusCode: 401 });
  }
  assert.equal(create.mock.callCount(), 0);
});

test('administrator environment settings cannot promote an existing customer or owner', async (t) => {
  legacyConfiguration(t);
  const password = await hashPassword(process.env.ADMIN_PASSWORD);
  for (const role of ['customer', 'owner']) {
    let saves = 0;
    const user = { _id: 'existing-user', email: process.env.ADMIN_EMAIL, role, password, save: async () => { saves++; } };
    t.mock.method(User, 'findOne', () => ({ select: async () => user }));
    await assert.rejects(login({ email: user.email, password: process.env.ADMIN_PASSWORD, requiredRole: 'admin' }), { statusCode: 403 });
    assert.equal(user.role, role);
    assert.equal(saves, 0);
  }
});

test('existing administrators authenticate only with the stored password hash', async (t) => {
  legacyConfiguration(t);
  const storedPassword = 'ActualStored!456';
  const user = { _id: 'existing-admin', name: 'Administrator', email: process.env.ADMIN_EMAIL, role: 'admin', password: await hashPassword(storedPassword) };
  t.mock.method(User, 'findOne', () => ({ select: async () => user }));
  const create = t.mock.method(User, 'create', async () => { throw new Error('Unexpected account creation'); });
  await assert.rejects(login({ email: user.email, password: process.env.ADMIN_PASSWORD, requiredRole: 'admin' }), { statusCode: 401 });
  const result = await login({ email: user.email, password: storedPassword, requiredRole: 'admin' });
  assert.equal(result.user.role, 'admin');
  assert.ok(result.token);
  assert.equal(result.user.password, undefined);
  assert.equal(create.mock.callCount(), 0);
});

test('public registration cannot provision an administrator', async (t) => {
  const create = t.mock.method(User, 'create', async () => { throw new Error('Unexpected account creation'); });
  await assert.rejects(register({ name: 'Applicant', email: 'applicant@example.com', password: 'ValidPassword!123', role: 'admin' }), { statusCode: 403 });
  assert.equal(create.mock.callCount(), 0);
});
