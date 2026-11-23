import test from 'node:test';
import assert from 'node:assert/strict';
import Business from '../src/modules/business/business.model.js';
import { isCategoryLocked, selectBusinessCategory, updateBusiness, saveOnboardingStep } from '../src/modules/business/business.service.js';

test('business category gate and admin restrictions', async (t) => {
  const business = {
    _id: 'venue', owner: 'owner', category: 'clinic',
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
  await assert.rejects(saveOnboardingStep("venue", "owner", 1, { name: "Venue", category: "salon" }), /Enable clinic access/);
  await assert.rejects(selectBusinessCategory('venue', 'owner', 'other'), /Enable clinic access/);
  await selectBusinessCategory('venue', 'owner', 'clinic');
  assert.equal(business.category, 'clinic');
  assert.equal(isCategoryLocked(business), true);
  await assert.rejects(selectBusinessCategory('venue', 'owner', 'clinic'), /Ask the admin/);
  assert.equal(selections, 1);
  await assert.rejects(updateBusiness('venue', 'owner', { category: 'salon' }), /Ask the admin/);
  await assert.rejects(saveOnboardingStep('venue', 'owner', 1, { name: 'Venue', category: 'salon' }), /Category must be one of/);
  await assert.rejects(updateBusiness('venue', 'admin', { category: 'salon' }, 'admin'), /Only clinics are supported/);
  assert.equal(business.category, 'clinic');
  assert.equal(isCategoryLocked({ onboarding: { status: 'COMPLETED' } }), true);
  assert.equal(isCategoryLocked({ onboarding: { completedSteps: [1] } }), true);
});
