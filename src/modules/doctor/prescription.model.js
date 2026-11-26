import mongoose from 'mongoose';
import { clinicalFields, decryptPrescription, encryptPrescription } from './prescription-encryption.js';
import { indexVisitNotices, visitNoticeSchema } from '../whatsapp/visit-notice-outbox.js';

const requiresPlaintext = function () { return this.isNew || this.encryptedClinicalData === undefined; };
const notificationSchema = new mongoose.Schema({
  version: Number, state: String, attempts: Number,
  createdAt: Date, nextAt: Date, expiresAt: Date, lease: String, leaseUntil: Date,
  callback: String, reason: String,
}, { _id: false });

const schema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, immutable: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true, immutable: true },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true, index: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true, index: true },
  doctorName: { type: String, required: requiresPlaintext },
  doctorId: { type: String, required: requiresPlaintext },
  patientName: { type: String, required: requiresPlaintext },
  clinicName: { type: String, required: requiresPlaintext },
  symptoms: { type: String, maxlength: 10000 },
  diagnosis: { type: String, maxlength: 10000, required: requiresPlaintext },
  medications: { type: String, maxlength: 10000 },
  investigations: { type: String, maxlength: 10000 },
  advice: { type: String, maxlength: 10000 },
  followUp: { type: String, maxlength: 2000 },
  followUpDate: { type: String },
  encryptedClinicalData: { type: String },
  reminderNextRunAt: { type: Date, select: false },
  reminderExpiresAt: { type: Date, select: false },
  whatsappNotification: { type: notificationSchema, select: false },
  whatsappVisitNotice: { type: visitNoticeSchema, select: false, transform: () => undefined },
}, { timestamps: true });

schema.pre('save', function () {
  const envelope = this.encryptedClinicalData;
  const changed = clinicalFields.filter(field => this.isModified(field));
  if (!this.isNew && envelope !== undefined && !changed.length) return;
  const fields = !this.isNew && envelope !== undefined ? decryptPrescription(this, envelope) : {};
  for (const field of this.isNew || envelope === undefined ? clinicalFields : changed) fields[field] = this[field];
  this.encryptedClinicalData = encryptPrescription(this, fields);
  for (const field of clinicalFields) this[field] = undefined;
});

schema.index({ reminderNextRunAt: 1, reminderExpiresAt: 1 }, {
  partialFilterExpression: { reminderNextRunAt: { $exists: true } },
});
schema.index({ 'whatsappNotification.state': 1, 'whatsappNotification.nextAt': 1 }, {
  partialFilterExpression: { 'whatsappNotification.state': { $exists: true } },
});
schema.index({ 'whatsappNotification.state': 1, 'whatsappNotification.leaseUntil': 1 }, {
  partialFilterExpression: { 'whatsappNotification.leaseUntil': { $exists: true } },
});
schema.index({ booking: 1, doctor: 1 }, { unique: true });
indexVisitNotices(schema);
export default mongoose.model('Prescription', schema);
