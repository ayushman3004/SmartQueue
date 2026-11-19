import crypto from 'node:crypto';
import mongoose from 'mongoose';
import SubscriptionCoupon from './subscription-coupon.model.js';
import Business from '../business/business.model.js';
import User from '../auth/auth.model.js';
import ApiError from '../../../utils/ApiError.js';
import { sanitize } from '../auth/auth.service.js';
import { ownerState } from '../business-application/owner-lifecycle.js';
import { sendBusinessNotice } from '../business-application/business-application.email.js';
import { oauthClientUrl } from '../auth/oauth-security.js';

const DAY = 86400000;
const validId = value => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
const active = sub => sub?.status === 'ACTIVE' && ['BASIC', 'PRO'].includes(sub.plan) && (!sub.expiresAt || new Date(sub.expiresAt).getTime() > Date.now());
export const couponView = coupon => coupon ? ({
  code: coupon.code, businessId: coupon.businessId, businessName: coupon.businessName,
  plan: coupon.plan, durationDays: coupon.durationDays, status: coupon.status,
  redeemBy: coupon.redeemBy, redeemedAt: coupon.redeemedAt, subscriptionExpiresAt: coupon.subscriptionExpiresAt,
  email: coupon.email, emailStatus: coupon.emailStatus, emailedAt: coupon.emailedAt,
}) : null;

export const getBusinessSubscriptionCoupon = async businessId => {
  if (!validId(businessId)) throw new ApiError(400, 'Invalid business ID');
  return couponView(await SubscriptionCoupon.findOne({ businessId }));
};

export const issueBusinessSubscriptionCoupon = async (businessId, adminId) => {
  if (!validId(businessId)) throw new ApiError(400, 'Invalid business ID');
  const business = await Business.findById(businessId);
  if (!business) throw new ApiError(404, 'Business not found');
  if (business.approvalStatus !== 'approved') throw new ApiError(409, 'Approve this business before issuing its free coupon.');
  const email = String(business.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'Add a valid business email before generating its coupon.');
  const owner = await User.findById(business.owner);
  if (!owner || owner.role !== 'owner') throw new ApiError(409, 'This business needs a registered business owner.');
  let coupon = await SubscriptionCoupon.findOne({ businessId });
  if (!coupon) {
    const prefix = business.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'BUSINESS';
    try {
      coupon = await SubscriptionCoupon.create({ businessId, ownerId: owner._id, createdBy: adminId,
        businessName: business.name, code: `${prefix}-PRO-${crypto.randomBytes(6).toString('hex').toUpperCase()}`,
        plan: 'PRO', durationDays: 30, redeemBy: new Date(Date.now() + 90 * DAY), email });
    } catch (error) {
      if (error.code !== 11000) throw error;
      coupon = await SubscriptionCoupon.findOne({ businessId });
      if (!coupon) throw error;
    }
  }
  if (String(coupon.ownerId) !== String(business.owner)) throw new ApiError(409, 'Business ownership changed. This initial coupon cannot be reassigned.');
  if (coupon.status === 'REDEEMED') throw new ApiError(409, 'This business has already redeemed its free Pro coupon.');
  if (new Date(coupon.redeemBy).getTime() <= Date.now()) throw new ApiError(409, 'This business’s initial free coupon has expired.');

  const now = new Date();
  const claimed = await SubscriptionCoupon.findOneAndUpdate({ _id: coupon._id, status: 'ISSUED',
    $and: [{ $or: [{ emailLeaseUntil: null }, { emailLeaseUntil: { $lte: now } }] },
      { $or: [{ lastEmailAttemptAt: null }, { lastEmailAttemptAt: { $lte: new Date(Date.now() - 60000) } }] }] },
  { $set: { emailStatus: 'SENDING', emailLeaseUntil: new Date(Date.now() + 120000), lastEmailAttemptAt: now, email } }, { new: true });
  if (!claimed) throw new ApiError(429, 'A coupon email was just requested. Wait one minute before resending.');
  let sent = false;
  try {
    sent = await sendBusinessNotice({ to: email, subject: `Your free Pro month for ${business.name}`,
      action: { url: oauthClientUrl('/subscription'), label: 'Activate your free Pro month' },
      lines: [`ServeQ has reserved a free Pro subscription for ${business.name}.`,
        `Your single-use coupon: ${claimed.code}`,
        `Sign in with this business’s approved owner account, open Subscription, and enter this code. It activates Pro for ${claimed.durationDays} days for this business only.`,
        'Price: ₹0. No card, Razorpay payment, or automatic renewal is required.',
        `Redeem before ${new Date(claimed.redeemBy).toISOString()} (UTC). The free month starts when you redeem it. If a subscription is already active, wait for it to expire before redeeming.`,
        'Complete your account invitation and email verification first if you have not activated your owner account.'] });
  } catch { sent = false; }
  coupon = await SubscriptionCoupon.findOneAndUpdate({ _id: claimed._id, emailLeaseUntil: claimed.emailLeaseUntil },
    { $set: { emailStatus: sent ? 'SENT' : 'FAILED', emailLeaseUntil: null, ...(sent ? { emailedAt: new Date() } : {}) } }, { new: true });
  return { coupon: couponView(coupon || claimed), emailSent: Boolean(sent) };
};

export const redeemBusinessSubscriptionCoupon = async (userId, rawCode) => {
  if (typeof rawCode !== 'string' || !/^[A-Z0-9-]{8,64}$/i.test(rawCode.trim())) throw new ApiError(400, 'Enter a valid business coupon code.');
  const code = rawCode.trim().toUpperCase();
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const coupon = await SubscriptionCoupon.findOne({ code }).session(session);
      if (!coupon) throw new ApiError(404, 'Invalid coupon code.');
      if (String(coupon.ownerId) !== String(userId)) throw new ApiError(403, 'This coupon belongs to another business owner.');
      if (coupon.status !== 'ISSUED') throw new ApiError(409, 'This coupon has already been activated.');
      const now = new Date();
      if (new Date(coupon.redeemBy) <= now) throw new ApiError(409, 'This coupon has expired.');
      const business = await Business.findById(coupon.businessId).session(session);
      const user = await User.findById(userId).session(session);
      if (!business || !user || user.role !== 'owner' || String(business.owner) !== String(userId) || business.approvalStatus !== 'approved' || ownerState(user) !== 'ACTIVE') throw new ApiError(403, 'An active owner account and approved business are required.');
      // Keep existing paid periods intact. A coupon cannot replace or downgrade them.
      if (active(user.subscription) || active(business.subscription)) throw new ApiError(409, 'A subscription is already active. Redeem this coupon after it expires.');
      const expiresAt = new Date(now.getTime() + 30 * DAY);
      const claimed = await SubscriptionCoupon.findOneAndUpdate({ _id: coupon._id, ownerId: userId, status: 'ISSUED', redeemBy: { $gt: now } },
        { $set: { status: 'REDEEMED', redeemedBy: userId, redeemedAt: now, subscriptionExpiresAt: expiresAt } }, { new: true, session });
      if (!claimed) throw new ApiError(409, 'This coupon has already been activated.');
      user.subscription = { plan: 'PRO', status: 'ACTIVE', amount: 0, activatedAt: now, expiresAt, businessId: business._id };
      business.subscription = { plan: 'PRO', status: 'ACTIVE', amount: 0, expiresAt };
      await user.save({ session });
      await business.save({ session });
      result = { user: sanitize(user), subscription: user.subscription, businessId: business._id, businessName: business.name };
    });
  } finally { await session.endSession(); }
  return result;
};
