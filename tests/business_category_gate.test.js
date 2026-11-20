import test from 'node:test';
import assert from 'node:assert/strict';
import Business from '../src/modules/business/business.model.js';
import { isCategoryLocked, selectBusinessCategory, updateBusiness, createBusiness, initOnboarding, saveOnboardingStep } from '../src/modules/business/business.service.js';

test('business category gate and admin restrictions', async (t) => {
  const business = {
    _id: 'venue', owner: 'owner', category: 'salon',
    onboarding: { status: 'IN_PROGRESS', completedSteps: [] },
    subscription: { status: 'ACTIVE', plan: 'BASIC' },
    async save() { return this; },
  };
  t.mock.method(Business, 'findOne', async () => business);
  t.mock.method(Business, 'exists', async () => ({ _id: 'venue' }));
  let selections = 0;
  t.mock.method(Business, 'findOneAndUpdate', async (_query, update) => {
    selections++;
    Object.assign(business, update.$set);
    return business;
  });
  assert.equal(isCategoryLocked(business), false);
  await assert.rejects(saveOnboardingStep("venue", "owner", 1, { name: "Venue", category: "salon" }), /Choose clinic or salon/);
  await assert.rejects(selectBusinessCategory('venue', 'owner', 'other'), /Choose clinic or salon/);
  await selectBusinessCategory('venue', 'owner', 'clinic');
  assert.equal(business.category, 'clinic');
  assert.equal(isCategoryLocked(business), true);
  await assert.rejects(selectBusinessCategory('venue', 'owner', 'salon'), /Ask the admin/);
  assert.equal(selections, 1);
  await assert.rejects(updateBusiness('venue', 'owner', { category: 'salon' }), /Ask the admin/);
  await assert.rejects(saveOnboardingStep('venue', 'owner', 1, { name: 'Venue', category: 'salon' }), /require the admin/);
  await assert.rejects(createBusiness('owner', { name: 'Another', category: 'salon' }), /Ask the admin/);
  await assert.rejects(initOnboarding('owner', { createNew: true }), /Ask the admin/);
  await updateBusiness('venue', 'admin', { category: 'salon' }, 'admin');
  assert.equal(business.category, 'salon');
  assert.equal(isCategoryLocked({ onboarding: { status: 'COMPLETED' } }), true);
  assert.equal(isCategoryLocked({ onboarding: { completedSteps: [1] } }), true);
});
