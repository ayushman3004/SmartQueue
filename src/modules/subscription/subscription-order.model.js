import mongoose from 'mongoose';

const subscriptionOrderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: String, enum: ['BASIC', 'PRO'], required: true },
  amount: { type: Number, required: true },
  paymentId: String,
  activatedAt: Date,
  expiresAt: Date,
}, { timestamps: true });

export default mongoose.model('SubscriptionOrder', subscriptionOrderSchema);
