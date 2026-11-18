import test from 'node:test';
import assert from 'node:assert/strict';
import Review from '../src/modules/review/review.model.js';
import Business from '../src/modules/business/business.model.js';
import Booking from '../src/booking/booking.model.js';
import Queue from '../src/queue/queue.model.js';
import { updateReview } from '../src/modules/review/review.service.js';
import { getMyBookings } from '../src/booking/booking.service.js';

test('Editing updates the existing review and ratings without increasing the review count', async (t) => {
  const review = {
    _id: 'review', businessId: 'venue', bookingId: 'booking', userId: 'customer', rating: 2,
    comment: 'Original', save: async () => {}, populate: async function () { return this; },
  };
  const business = { staff: [{ name: 'Dr. Lee' }], save: async () => {} };
  t.mock.method(Review, 'findOne', async (query) => {
    assert.deepEqual(query, { _id: 'review', userId: 'customer' });
    return review;
  });
  t.mock.method(Business, 'findById', async (id) => {
    assert.equal(id, 'venue');
    return business;
  });
  t.mock.method(Booking, 'findOne', async () => ({ assignedStaff: { name: 'Dr. Lee' } }));
  t.mock.method(Review, 'find', async () => [review, { rating: 3 }]);
  const create = t.mock.method(Review, 'create', async () => { throw new Error('Duplicate review'); });
  const updated = await updateReview({ reviewId: 'review', userId: 'customer', rating: 5, comment: 'Updated' });
  assert.equal(updated._id, 'review');
  assert.equal(updated.rating, 5);
  assert.equal(updated.comment, 'Updated');
  assert.equal(business.rating, 4);
  assert.equal(business.averageRating, 4);
  assert.equal(business.totalReviews, 2);
  assert.equal(business.reviewCount, 2);
  assert.equal(business.staff[0].rating, 4);
  assert.equal(create.mock.callCount(), 0);
});

test('Customers cannot edit another customer’s review', async (t) => {
  t.mock.method(Review, 'findOne', async (query) => {
    assert.deepEqual(query, { _id: 'review', userId: 'other-customer' });
    return null;
  });
  await assert.rejects(updateReview({ reviewId: 'review', userId: 'other-customer', rating: 5 }), { statusCode: 404 });
});

test('Editing validates the rating before saving', async () => {
  for (const rating of [0, 6, 'invalid', Infinity]) {
    await assert.rejects(updateReview({ reviewId: 'review', userId: 'customer', rating }), { statusCode: 400 });
  }
});

test('Reloaded bookings include the existing review ID, rating, and comment for editing', async (t) => {
  const bookingId = '507f1f77bcf86cd799439011';
  const storedReview = { _id: 'review', bookingId, rating: 4, comment: 'Saved review' };
  t.mock.method(Booking, 'find', () => ({
    populate: () => ({ sort: async () => [{ _id: bookingId, businessId: 'venue', status: 'completed' }] }),
  }));
  t.mock.method(Queue, 'find', () => ({ populate: async () => [] }));
  t.mock.method(Review, 'find', async () => [storedReview]);
  const [booking] = await getMyBookings('customer');
  assert.equal(booking.review._id, 'review');
  assert.equal(booking.review.rating, 4);
  assert.equal(booking.review.comment, 'Saved review');
});
