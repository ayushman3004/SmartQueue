import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['hub', 'booking', 'queue', 'account'], required: true },
  title: { type: String, required: true, maxlength: 120 },
  message: { type: String, required: true, maxlength: 600 },
  href: { type: String, default: '', maxlength: 300 },
  readAt: { type: Date, default: null },
  eventKey: { type: String, required: true, maxlength: 200 },
}, { timestamps: true });

notificationSchema.index({ recipient: 1, _id: -1 });
notificationSchema.index({ recipient: 1, readAt: 1 });
notificationSchema.index({ recipient: 1, eventKey: 1 }, { unique: true });

export default mongoose.model('Notification', notificationSchema);
