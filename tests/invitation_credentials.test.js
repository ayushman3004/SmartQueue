import test from 'node:test';
import assert from 'node:assert/strict';
import { generateInvitationCredentials } from '../src/modules/business-application/invitation-credentials.js';
import { validatePasswordStrength } from '../src/utils/validators.js';
import { validateInvitation } from '../src/modules/business-application/business-application.service.js';

test('invitation credentials are easy to type and meet existing password rules', () => {
  for (let sample = 0; sample < 1000; sample++) {
    const { password, credential } = generateInvitationCredentials();
    assert.equal(password.length, 8);
    assert.equal(validatePasswordStrength(password).isValid, true);
    assert.doesNotMatch(password, /[IOlo01]/);
    assert.match(credential, /^[1-9][0-9]{5}$/);
  }
});

test('activation rejects non-numeric, short and long codes before database lookup', async () => {
  const user = { ownerAccess: { applicationId: 'application', status: 'INVITED', invitationExpiresAt: new Date(Date.now() + 60000) } };
  for (const code of ['abc123', '12345', '1234567', '123 45', '１２３４５６', 123456]) {
    await assert.rejects(validateInvitation(user, code), /Invitation is invalid or expired/);
  }
});
