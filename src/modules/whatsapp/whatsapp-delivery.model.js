import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  _id: String,
  kind: { type: String, enum: ['otp', 'prescription'], required: true },
  providerId: String,
  status: { type: String, default: 'pending' },
  rank: { type: Number, default: 0 },
  statusAt: Date,
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
}, { timestamps: true });
schema.index({ providerId: 1 }, { unique: true, sparse: true });

const Delivery = mongoose.model('WhatsAppDelivery', schema);
export default Delivery;

export function beginDelivery(id, kind) {
  return Delivery.create({ _id: id, kind, expiresAt: new Date(Date.now() + 30 * 86_400_000) });
}

const ranks = { accepted: 1, sent: 2, failed: 3, delivered: 4, read: 5 };
export async function recordDelivery({ callback, providerId, status, at }) {
  const rank = ranks[status];
  const identity = callback
    ? { _id: callback, $or: [{ providerId }, { providerId: { $exists: false } }] }
    : { providerId };
  await Delivery.updateOne(
    { ...identity, rank: { $lt: rank } },
    { $set: { providerId, status, rank, statusAt: at } },
  );
}

export async function markDeliveryRejected(callback, outcome) {
  await Delivery.updateOne({ _id: callback, rank: 0 }, { $set: { status: outcome } });
}
