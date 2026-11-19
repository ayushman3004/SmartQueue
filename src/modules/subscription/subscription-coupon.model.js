import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, unique: true, immutable: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  businessName: { type: String, required: true },
  code: { type: String, required: true, unique: true, immutable: true },
  plan: { type: String, enum: ['PRO'], default: 'PRO', immutable: true },
  durationDays: { type: Number, enum: [30], default: 30, immutable: true },
  status: { type: String, enum: ['ISSUED', 'REDEEMED'], default: 'ISSUED' },
  redeemBy: { type: Date, required: true },
  redeemedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  redeemedAt: { type: Date, default: null },
  subscriptionExpiresAt: { type: Date, default: null },
  email: { type: String, required: true },
  emailStatus: { type: String, enum: ['PENDING', 'SENDING', 'SENT', 'FAILED'], default: 'PENDING' },
  emailLeaseUntil: { type: Date, default: null },
  lastEmailAttemptAt: { type: Date, default: null },
  emailedAt: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.model('SubscriptionCoupon', schema);
