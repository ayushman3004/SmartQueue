import mongoose from 'mongoose';
import Prescription from '../src/modules/doctor/prescription.model.js';

const args = process.argv.slice(2);
const id = args[0];
const apply = args[1] === '--apply';
if (!/^[0-9a-f]{24}$/i.test(id || '') || args.length !== (apply ? 2 : 1) || !process.env.MONGO_URI) {
  console.error('Usage: provide MONGO_URI explicitly and run node scripts/requeue-whatsapp-prescription.mjs <id> [--apply]');
  process.exitCode = 2;
} else {
  try {
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    const now = new Date();
    const filter = { _id: id, 'whatsappNotification.state': 'failed',
      'whatsappNotification.reason': { $in: ['provider_rejected', 'attempts_exhausted'] },
      'whatsappNotification.expiresAt': { $gt: now },
    };
    if (!apply) {
      console.log(await Prescription.exists(filter) ? 'Eligible for controlled reprocessing.' : 'No eligible notification.');
    } else {
      const result = await Prescription.updateOne(filter, {
        $set: { 'whatsappNotification.state': 'pending', 'whatsappNotification.nextAt': now, 'whatsappNotification.attempts': 0 },
        $unset: { 'whatsappNotification.reason': '', 'whatsappNotification.callback': '' },
      });
      console.log(result.modifiedCount ? 'Notification scheduled for reprocessing.' : 'No eligible notification.');
    }
  } catch {
    console.error('Notification reprocessing check failed.');
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
