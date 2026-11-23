import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  business: { type: mongoose.Schema.Types.ObjectId, ref: 'Business', required: true },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  doctorName: { type: String, required: true },
  doctorId: { type: String, required: true },
  patientName: { type: String, required: true },
  clinicName: { type: String, required: true },
  symptoms: { type: String, maxlength: 10000, default: '' },
  diagnosis: { type: String, maxlength: 10000, required: true },
  medications: { type: String, maxlength: 10000, default: '' },
  investigations: { type: String, maxlength: 10000, default: '' },
  advice: { type: String, maxlength: 10000, default: '' },
  followUp: { type: String, maxlength: 2000, default: '' },
  followUpDate: { type: String },
  reminderNextRunAt: { type: Date, select: false },
  reminderExpiresAt: { type: Date, select: false },
  reminderWhatsAppAttemptedAt: { type: Date, select: false },
}, { timestamps: true });
schema.index({ reminderNextRunAt: 1, reminderExpiresAt: 1 }, {
  partialFilterExpression: { reminderNextRunAt: { $exists: true } },
});
schema.index({ booking: 1, doctor: 1 }, { unique: true });
export default mongoose.model('Prescription', schema);
