import mongoose from 'mongoose';

export const visitNoticeSchema = new mongoose.Schema({
  createdAt: Date, nextAt: Date, expiresAt: Date, state: String, attempts: Number, lease: String, leaseUntil: Date,
}, { _id: false });

export function scheduleVisitNotice(sendAt, expiresAt, now = new Date()) {
  return {
    createdAt: now, nextAt: new Date(Math.max(sendAt.getTime(), now.getTime())),
    expiresAt, state: 'pending', attempts: 0,
  };
}

export function indexVisitNotices(schema) {
  schema.index({ 'whatsappVisitNotice.state': 1, 'whatsappVisitNotice.nextAt': 1 }, {
    partialFilterExpression: { 'whatsappVisitNotice.state': { $exists: true } },
  });
  schema.index({ 'whatsappVisitNotice.leaseUntil': 1 }, {
    partialFilterExpression: { 'whatsappVisitNotice.leaseUntil': { $exists: true } },
  });
  schema.index({ 'whatsappVisitNotice.state': 1, 'whatsappVisitNotice.expiresAt': 1 }, {
    partialFilterExpression: { 'whatsappVisitNotice.state': { $exists: true } },
  });
}
