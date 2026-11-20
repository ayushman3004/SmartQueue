import assert from 'node:assert/strict';
import test from 'node:test';
import { sendEmailMessage, sendEmailWithReceipt } from '../src/modules/auth/verification.service.js';

test('the sender preserves Resend references while existing callers receive a boolean', async t => {
  const previous = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 'test-only';
  t.after(() => {
    if (previous === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previous;
  });
  const id = '01a1f9d9-65a1-7890-98e5-2d4717050e08';
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ id }) }));
  const message = { to: 'doctor@example.test', subject: 'Invitation', text: 'Sample text' };
  assert.deepEqual(await sendEmailWithReceipt(message), { accepted: true, resendId: id });
  assert.equal(await sendEmailMessage(message), true);
});
