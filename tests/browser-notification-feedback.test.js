import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createNotificationFeedback,
  getNotificationFeedback,
  pageNotificationScope,
  readSessionFeedback,
  setFeedbackAccount,
} from '../src/modules/notification/browser-feedback.js';

test('shows feedback in its own surface and keeps confirmations in the signed-in inbox', () => {
  setFeedbackAccount('customer');
  try {
    const scope = pageNotificationScope('/booking');
    const page = createNotificationFeedback(scope);
    const dialog = createNotificationFeedback('review-dialog');
    page.success('Profile saved');
    dialog.error('Please provide a rating');
    page.success('Booking confirmed', { inbox: false });

    const { notices, inbox } = getNotificationFeedback();
    assert.equal(notices.get(scope).message, 'Booking confirmed');
    assert.equal(notices.get('review-dialog').message, 'Please provide a rating');
    assert.deepEqual(inbox.map(entry => entry.message), ['Profile saved']);

    dialog.dismiss();
    assert.equal(getNotificationFeedback().notices.has('review-dialog'), false);
    readSessionFeedback(inbox[0]._id);
    assert.ok(getNotificationFeedback().inbox[0].readAt);
  } finally {
    setFeedbackAccount(null);
  }
});

test('rejects late feedback from a signed-out account and keeps guest feedback out of the inbox', () => {
  setFeedbackAccount('previous-customer');
  try {
    const beforeLogout = createNotificationFeedback('profile');
    beforeLogout.success('Previous account confirmation');
    setFeedbackAccount(null);
    createNotificationFeedback('sign-in').success('Password reset');
    assert.equal(getNotificationFeedback().inbox.length, 0);
    assert.equal(getNotificationFeedback().notices.has('profile'), false);

    setFeedbackAccount('next-customer');
    beforeLogout.error('Late response from previous account');
    assert.equal(getNotificationFeedback().notices.size, 0);
    assert.equal(getNotificationFeedback().inbox.length, 0);
  } finally {
    setFeedbackAccount(null);
  }
});
