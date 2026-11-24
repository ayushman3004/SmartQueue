import mongoose from 'mongoose';
import { clinicalFields, decryptPrescription, encryptPrescription } from './prescription-encryption.js';

const requiresPlaintext = function () { return this.isNew || this.encryptedClinicalData === undefined; };
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
  reminderWhatsAppAttemptedAt: { type: Date, select: false },
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
schema.index({ booking: 1, doctor: 1 }, { unique: true });
export default mongoose.model('Prescription', schema);
