import mongoose from 'mongoose';
import ApiError from '../../utils/ApiError.js';
import Booking from '../booking/booking.model.js';
import User from '../modules/auth/auth.model.js';
import { provisionWalkInAccount } from '../modules/auth/walk-in-account.service.js';
import Business from '../modules/business/business.model.js';
import { isClinic, isAssignedToDoctor, ref } from '../modules/doctor/doctor-access.js';
import { isBusinessSubscriptionActive } from '../modules/subscription/subscription.service.js';
import { canAccessOwnerCategory } from '../utils/ownerCategory.js';
import { normalizePhoneNumber } from '../utils/phoneNumbers.js';
import Queue from './queue.model.js';
import QueueDS from './queue.ds.js';
import { publishQueue } from './queue.view.js';

export async function checkInWalkIn(businessId, actor, input) {
  if (!mongoose.isObjectIdOrHexString(businessId)) throw new ApiError(404, 'Clinic not found.');
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  const phone = normalizePhoneNumber(input?.phone);
  if (!name || name.length > 120 || !phone) throw new ApiError(400, 'Enter a patient name and a valid mobile number.');

  const clinic = await Business.findById(businessId);
  if (!isClinic(clinic) || clinic.approvalStatus !== 'approved' || ref(clinic.owner) !== ref(actor._id) ||
    (actor.role !== 'admin' && !(actor.role === 'owner' && canAccessOwnerCategory(actor, clinic)))) {
    throw new ApiError(404, 'Clinic not found.');
  }
  if (!await isBusinessSubscriptionActive(clinic)) throw new ApiError(403, 'The clinic subscription is inactive.');

  // A concurrent first visit can claim the phone or create the queue before this transaction commits.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await mongoose.connection.transaction(async session => {
        const business = await Business.findById(businessId).session(session);
        if (!isClinic(business) || ref(business.owner) !== ref(actor._id) || business.approvalStatus !== 'approved' ||
          !business.isActive || !business.isOpen || business.queueSettings?.enableLiveQueue === false || business.queueSettings?.allowWalkIns === false) {
          throw new ApiError(409, 'This clinic is currently closed for walk-in check-ins.');
        }

        const queue = await Queue.findOne({ businessId }).session(session) || new Queue({ businessId });
        const doctors = await User.find({ role: 'doctor', 'doctorAccess.status': 'ACTIVE', 'doctorAccess.businessId': businessId })
          .select('email doctorAccess').session(session);
        const eligible = (business.staff || []).filter(staff => staff.isAvailable !== false && staff.doctorId &&
          (doctors.some(doctor => ref(doctor.doctorAccess.staffId) === ref(staff._id) && doctor.email === staff.email?.toLowerCase() &&
            doctor.doctorAccess.doctorId === staff.doctorId) || (business.adminTestKind === 'clinic' && actor.role === 'admin' && staff.email === actor.email)));
        const candidates = eligible.map(staff => ({ staff, load: queue.users.filter(row => isAssignedToDoctor(row, { business, staff })).length }));
        candidates.sort((a, b) => a.load - b.load);
        const staff = candidates[0]?.staff;
        if (!staff) throw new ApiError(409, 'An available doctor with dashboard access is required for walk-in check-in.');

        const patient = await provisionWalkInAccount(name, phone, session);
        if (queue.users.some(row => ref(row.userId) === ref(patient._id))) throw new ApiError(409, 'This patient is already in the live queue.');
        if (queue.users.length >= (business.queueSettings?.maxQueueCapacity || 50)) throw new ApiError(409, 'The live queue is full.');

        const joinedAt = new Date();
        const duration = business.averageServiceTime || 15;
        const price = business.basePrice || 0;
        const assignedStaff = { staffId: staff._id, name: staff.name, role: staff.role || 'Doctor', autoAssigned: true };
        const services = [{ name: 'General consultation', duration, price }];
        const booking = await new Booking({
          businessId, userId: patient._id, walkIn: true, assignedStaff, status: 'waiting',
          startTime: joinedAt, endTime: new Date(joinedAt.getTime() + duration * 60_000),
          duration, services, serviceType: services[0].name, paidAmount: price,
          ...(input.whatsappConsent === true && { walkInWhatsApp: { phone, consentAt: joinedAt } }),
        }).save({ session });
        const queueDS = QueueDS.fromArray(queue.users);
        queueDS.enqueue({ userId: patient._id, bookingId: booking._id, walkIn: true, joinedAt,
          serviceTime: duration, serviceType: booking.serviceType, services, assignedStaff, paidAmount: price });
        queue.users = queueDS.toArray();
        await queue.save({ session });
        return { queue, booking };
      });
    } catch (error) {
      if (error.code !== 11000 || attempt === 2) throw error;
    }
  }
}

export async function cancelWalkIn(bookingId, userId, io) {
  const { booking, queue } = await mongoose.connection.transaction(async session => {
    const booking = await Booking.findOneAndUpdate({ _id: bookingId, userId, walkIn: true, status: 'waiting' },
      { $set: { status: 'cancelled' } }, { returnDocument: 'after', session });
    if (!booking) throw new ApiError(409, 'Only a waiting walk-in can be cancelled.');
    const queue = await Queue.findOne({ businessId: booking.businessId }).session(session);
    if (queue?.users.some(row => ref(row.bookingId) === ref(bookingId))) {
      const queueDS = QueueDS.fromArray(queue.users);
      queueDS.remove(userId);
      queue.users = queueDS.toArray();
      await queue.save({ session });
    }
    return { booking, queue };
  });
  publishQueue(io, booking.businessId, queue);
  io?.to(`user:${userId}`).emit('bookings:updated');
  return { booking, queue };
}
