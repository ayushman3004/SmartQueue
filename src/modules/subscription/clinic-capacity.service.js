import mongoose from 'mongoose';
import User from '../auth/auth.model.js';
import Business from '../business/business.model.js';
import { serviceCategories } from '../../utils/customerService.js';
import { hasActiveSubscription } from '../../utils/subscription.js';
import { SUBSCRIPTION_PLANS } from '../../shared/subscriptionPlans.js';
import ApiError from '../../../utils/ApiError.js';

const ownerIdFor = clinic => clinic.owner?._id || clinic.owner;
const activeClinics = owner => ({
  owner, category: { $in: serviceCategories.clinic }, isActive: { $ne: false },
});

function clinicPlan(clinic, owner) {
  const account = owner?.subscription;
  if (hasActiveSubscription(account) && (!account.businessId || String(account.businessId) === String(clinic._id))) {
    return SUBSCRIPTION_PLANS[account.plan];
  }
  return hasActiveSubscription(clinic.subscription) ? SUBSCRIPTION_PLANS[clinic.subscription.plan] : null;
}

export async function getActiveClinicPlan(clinic, session = null) {
  if (!clinic) return null;
  const owner = clinic.owner?.role ? clinic.owner : await User.findById(ownerIdFor(clinic), 'role subscription', { session });
  return owner?.role === 'admin' ? SUBSCRIPTION_PLANS.PRO : clinicPlan(clinic, owner);
}

export async function isWithinClinicCapacity(clinic, session = null) {
  const ownerId = ownerIdFor(clinic);
  if (!ownerId || clinic.adminTestKind) return true;
  const owner = clinic.owner?.role ? clinic.owner : await User.findById(ownerId, 'role subscription', { session });
  if (owner?.role === 'admin') return true;
  // A clinic-scoped coupon gives its own clinic a seat without extending to other clinics.
  if (hasActiveSubscription(owner?.subscription) && String(owner.subscription.businessId) === String(clinic._id)) {
    return true;
  }
  const plan = clinicPlan(clinic, owner);
  if (!plan) return false;
  const earlier = await Business.countDocuments({ ...activeClinics(ownerId), _id: { $lt: clinic._id } }, { session });
  return earlier < plan.maxActiveClinics;
}

export async function saveClinicActivation(filter, change, { requireSubscription = false } = {}) {
  return mongoose.connection.transaction(async session => {
    const clinic = await Business.findOne(filter, null, { session });
    if (!serviceCategories.clinic.includes(clinic?.category)) throw new ApiError(404, 'Clinic not found.');
    const wasActive = clinic.isActive;
    if (change(clinic) === false) return clinic;

    if (clinic.isActive && (requireSubscription || !wasActive)) {
      const ownerId = ownerIdFor(clinic);
      // Concurrent activations for this owner conflict and retry before counting clinics.
      const owner = await User.findOneAndUpdate({ _id: ownerId }, { $inc: { clinicActivationRevision: 1 } },
        { session, projection: 'role subscription', timestamps: false });
      if (!owner) throw new ApiError(404, 'Clinic owner not found.');
      if (owner.role !== 'admin') {
        const plan = clinicPlan(clinic, owner);
        if (requireSubscription && !plan) throw new ApiError(403, 'An active ServeQ subscription is required to launch this clinic.');
        const capacityPlan = plan || SUBSCRIPTION_PLANS.BASIC;
        if (!wasActive && await Business.countDocuments({ ...activeClinics(ownerId), _id: { $ne: clinic._id } }, { session }) >= capacityPlan.maxActiveClinics) {
          throw new ApiError(409, `This account has reached its limit of ${capacityPlan.maxActiveClinics} active clinics.`);
        }
      }
    }
    await clinic.save({ session });
    return clinic;
  });
}
