import { publishQueue } from "../../queue/queue.view.js";
import { Router } from 'express';
import mongoose from 'mongoose';
import { protect, allowRoles, requireVerifiedEmail } from '../../../middleware/auth.middleware.js';
import asyncHandler from '../../../utils/asyncHandler.js';
import ApiError from '../../../utils/ApiError.js';
import User from '../auth/auth.model.js';
import Business from '../business/business.model.js';
import Queue from '../../queue/queue.model.js';
import Booking from '../../booking/booking.model.js';
import Prescription from './prescription.model.js';
import { prescriptionDeliveryStatus, schedulePrescriptionNotification } from '../whatsapp/prescription-notifications.js';
import { readPrescription } from './prescription-encryption.js';
import { doctorContext, ref, isClinic, isAssignedToDoctor, requireAssigned, prescriptionFilter } from './doctor-access.js';
import { generateInvitationCredentials } from '../business-application/invitation-credentials.js';
import { validateOwnerPassword } from '../business-application/owner-lifecycle.js';
import { sendBusinessNotice } from '../business-application/business-application.email.js';
import { hashPassword, comparePassword, generateToken, setTokenCookie, responseToken } from '../auth.utils.js';
import { sanitize } from '../auth/auth.service.js';
import { isBusinessSubscriptionActive } from '../subscription/subscription.service.js';
import { getActiveClinicPlan } from '../subscription/clinic-capacity.service.js';
import * as queueService from '../../queue/queue.service.js';
import * as bookingService from '../../booking/booking.service.js';
import { scheduleFollowUp } from './follow-up-reminder.service.js';
import { scheduleVisitNotice } from '../whatsapp/visit-notice-outbox.js';
import { prescriptionPdf } from './prescription.pdf.js';
import { accountSecurityLimit, doctorAccessLimit } from '../../gateway/endpointRateLimits.js';

const router = Router();
router.use(protect, (_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
const validId = value => { if (!mongoose.isValidObjectId(value)) throw new ApiError(400, 'Invalid record.'); return value; };
const ownerBusiness = async req => {
  const business = await Business.findById(validId(req.params.businessId));
  if (!business || !isClinic(business) || (req.user.role !== 'admin' && ref(business.owner) !== ref(req.user))) throw new ApiError(403, 'Not your clinic.');
  return business;
};

router.get('/owner/:businessId', allowRoles('owner'), asyncHandler(async (req, res) => {
  const business = await ownerBusiness(req);
  const accounts = await User.find({ role: 'doctor', 'doctorAccess.businessId': business._id }).select('name email doctorAccess');
  res.json({ data: { doctors: business.staff.map(staff => {
    const account = accounts.find(user => ref(user.doctorAccess.staffId) === ref(staff._id) && user.email === staff.email && user.doctorAccess.doctorId === staff.doctorId);
    return { staffId: staff._id, name: staff.name, email: staff.email, doctorId: staff.doctorId, status: account?.doctorAccess.status || 'NOT_INVITED', delivery: account?.doctorAccess.invitationDelivery, canCheckDelivery: Boolean(account?.doctorAccess.invitationResendId), mustChangePassword: account?.doctorAccess.mustChangePassword };
  }) } });
}));
router.post('/owner/:businessId/:staffId/invite', allowRoles('owner'), requireVerifiedEmail, doctorAccessLimit, asyncHandler(async (req, res) => {
  const business = await ownerBusiness(req);
  const staff = business.staff.find(member => ref(member._id) === req.params.staffId);
  if (!staff || !staff.doctorId?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staff.email || '')) throw new ApiError(400, 'Save the doctor email and registration ID in the roster first.');
  const password = generateInvitationCredentials().password;
  const passwordHash = await hashPassword(password);
  let account = await User.findOne({ email: staff.email });
  if (account && (account.role !== 'doctor' || ref(account.doctorAccess?.businessId) !== ref(business._id) || ref(account.doctorAccess?.staffId) !== ref(staff._id))) throw new ApiError(409, 'This email already belongs to another account.');
  const doctorAccess = { businessId: business._id, staffId: staff._id, doctorId: staff.doctorId, status: 'ACTIVE', mustChangePassword: true };
  if (account) {
    account.password = passwordHash;
    account.name = staff.name;
    account.doctorAccess = doctorAccess;
    account.tokenVersion = (account.tokenVersion || 0) + 1;
    await account.save();
  } else account = await User.create({ name: staff.name, email: staff.email, role: 'doctor', password: passwordHash, doctorAccess });
  const base = (process.env.CLIENT_URL || 'https://serveq.tech').replace(/\/$/, '');
  const receipt = await sendBusinessNotice({ includeReceipt: true, to: staff.email, subject: 'Your ServeQ doctor dashboard access', lines: [
    `${business.name} has invited you as ${staff.name}. Doctor ID: ${staff.doctorId}.`,
    `Sign in at ${base}/doctor/login using ${staff.email}. Temporary password: ${password}`,
    'Change your temporary password before opening patient records. Your dashboard contains only your assigned patients and your prescriptions.',
  ], action: { label: 'Doctor sign in', url: `${base}/doctor/login` } }).catch(() => ({ accepted: false }));
  const delivery = receipt.accepted ? 'SENT' : 'FAILED';
  const update = { 'doctorAccess.invitationDelivery': delivery };
  if (receipt.resendId) update['doctorAccess.invitationResendId'] = receipt.resendId;
  await User.updateOne({ _id: account._id, tokenVersion: account.tokenVersion }, { $set: update });
  res.json({ data: { delivery } });
}));
router.get('/owner/:businessId/:staffId/delivery', allowRoles('owner'), asyncHandler(async (req, res) => {
  const business = await ownerBusiness(req);
  const staff = business.staff.find(member => ref(member._id) === req.params.staffId);
  if (!staff) throw new ApiError(404, 'Doctor not found.');
  const account = await User.findOne({
    role: 'doctor', email: staff.email, 'doctorAccess.businessId': business._id,
    'doctorAccess.staffId': staff._id, 'doctorAccess.doctorId': staff.doctorId,
  });
  const id = account?.doctorAccess.invitationResendId;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) throw new ApiError(404, 'No delivery reference was saved for this invitation.');
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new ApiError(503, 'Email delivery lookup is unavailable.');
  const response = await fetch(`https://api.resend.com/emails/${id}`, {
    headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5000),
  }).catch(() => null);
  if (!response?.ok) throw new ApiError(503, 'Could not check delivery with the email provider.');
  const { last_event: event } = await response.json();
  const statuses = { delivered: 'DELIVERED', opened: 'DELIVERED', clicked: 'DELIVERED', bounced: 'BOUNCED', suppressed: 'BOUNCED', delivery_delayed: 'DELAYED', failed: 'FAILED' };
  const delivery = Object.hasOwn(statuses, event) ? statuses[event] : 'SENT';
  await User.updateOne({ _id: account._id, 'doctorAccess.invitationResendId': id }, { $set: { 'doctorAccess.invitationDelivery': delivery } });
  res.json({ data: { delivery } });
}));
router.post('/owner/:businessId/:staffId/revoke', allowRoles('owner'), doctorAccessLimit, asyncHandler(async (req, res) => {
  const business = await ownerBusiness(req);
  await User.updateOne({ role: 'doctor', 'doctorAccess.businessId': business._id, 'doctorAccess.staffId': validId(req.params.staffId) }, { $set: { 'doctorAccess.status': 'REVOKED' }, $inc: { tokenVersion: 1 } });
  res.json({ message: 'Doctor access revoked.' });
}));
router.post('/password', allowRoles('doctor'), accountSecurityLimit, asyncHandler(async (req, res) => {
  validateOwnerPassword(req.body.newPassword);
  const doctor = await User.findById(req.user._id).select('+password');
  if (!await comparePassword(req.body.currentPassword || '', doctor.password)) throw new ApiError(400, 'Current password is incorrect.');
  if (await comparePassword(req.body.newPassword, doctor.password)) throw new ApiError(400, 'Choose a different password.');
  const updated = await User.findOneAndUpdate(
    { _id: doctor._id, tokenVersion: doctor.tokenVersion, 'doctorAccess.status': 'ACTIVE' },
    { $set: { password: await hashPassword(req.body.newPassword), 'doctorAccess.mustChangePassword': false }, $inc: { tokenVersion: 1 } },
    { new: true },
  );
  if (!updated) throw new ApiError(409, 'Your access changed. Sign in again.');
  const token = generateToken(updated);
  setTokenCookie(res, token, req);
  res.json({ data: { user: sanitize(updated), ...responseToken(req, token) } });
}));
router.get('/dashboard', allowRoles('doctor', 'admin'), asyncHandler(async (req, res) => {
  const context = await doctorContext(req.user);
  if (!await isBusinessSubscriptionActive(context.business)) throw new ApiError(403, 'The clinic subscription is inactive. Contact your business owner.');
  const hasServiceSequencing = (await getActiveClinicPlan(context.business))?.id === 'PRO';
  const queue = await Queue.findOne({ businessId: context.business._id }).populate('users.userId', 'name email phone');
  const legacyName = RegExp.escape(context.staff.name);
  const bookings = await Booking.find({
    businessId: context.business._id,
    status: { $nin: ['cancelled', 'refunded'] },
    $or: [
      { 'assignedStaff.staffId': context.staff._id },
      { 'assignedStaff.staffId': null, 'assignedStaff.name': { $regex: `^${legacyName}$`, $options: 'i' } },
    ],
  }).sort({ startTime: -1 }).populate('userId', 'name email phone');
  res.json({ data: { clinic: { _id: context.business._id, name: context.business.name, hasServiceSequencing }, doctor: { name: context.staff.name, doctorId: context.staff.doctorId }, queue: (queue?.users || []).filter(row => isAssignedToDoctor(row, context)), bookings: bookings.filter(row => isAssignedToDoctor(row, context)) } });
}));
const minutes = value => { const number = Number(value); if (!Number.isInteger(number) || number < 1 || number > 120) throw new ApiError(400, 'Extension must be 1-120 minutes.'); return number; };
const notify = (req, businessId) => { req.app.get('io')?.to(`business:${businessId}`).emit('bookings:updated'); };
router.post('/queue/:patientId/:action', allowRoles('doctor', 'admin'), asyncHandler(async (req, res) => {
  const context = await doctorContext(req.user);
  if (!await isBusinessSubscriptionActive(context.business)) throw new ApiError(403, 'Clinic subscription inactive.');
  const queue = await Queue.findOne({ businessId: context.business._id });
  const patientId = validId(req.params.patientId);
  const row = queue?.users.find(entry => ref(entry.userId) === patientId);
  requireAssigned(row, context);
  const businessId = context.business._id;
  const ownerId = context.business.owner;
  if (req.params.action === 'next') {
    if (row.status !== 'serving') throw new ApiError(400, 'Only the current consultation can be completed.');
    await queueService.callNext(businessId, ownerId, 'owner', req.app.get('io'), context.staff.name, req.params.patientId, null, context);
    const event = { businessId, doctorName: context.staff.name, calledAt: new Date().toISOString() };
    const io = req.app.get('io');
    io?.to([ `business:${businessId}:admin`, `user:${ownerId}` ]).emit('doctor:called-next', event);
  } else if (req.params.action === 'start') await queueService.startWalkInVisit(patientId, context, req.app.get('io'));
  else if (req.params.action === 'advance-service') await queueService.advanceQueueService(queue, patientId, req.body?.serviceStep, context, req.app.get('io'));
  else if (req.params.action === 'extend') await queueService.extendTime(businessId, req.params.patientId, minutes(req.body.minutes), ownerId, 'owner', req.app.get('io'), context);
  else if (req.params.action === 'payment') await queueService.collectQueuePayment(businessId, req.params.patientId, { _id: ownerId, role: 'owner' }, null, context);
  else throw new ApiError(400, 'Unknown queue action.');
  if (req.params.action === 'payment') publishQueue(req.app.get('io'), businessId, await Queue.findOne({ businessId }));
  notify(req, businessId);
  res.json({ message: 'Patient updated.' });
}));
router.post('/bookings/:bookingId/:action', allowRoles('doctor', 'admin'), asyncHandler(async (req, res) => {
  const context = await doctorContext(req.user);
  if (!await isBusinessSubscriptionActive(context.business)) throw new ApiError(403, 'Clinic subscription inactive.');
  const booking = await Booking.findById(validId(req.params.bookingId));
  requireAssigned(booking, context);
  if (['cancelled', 'refunded'].includes(booking.status)) throw new ApiError(400, 'This booking is closed.');
  const ownerId = context.business.owner;
  if (req.params.action === 'start') await bookingService.startService(booking._id, ownerId, 'owner', context, req.app.get('io'));
  else if (req.params.action === 'advance-service') await bookingService.advanceAppointmentService(booking, req.body?.serviceStep, context);
  else if (req.params.action === 'complete') await bookingService.completeService(booking._id, ownerId, 'owner', context);
  else if (req.params.action === 'extend') await bookingService.extendBooking(booking._id, minutes(req.body.minutes), ownerId, 'owner', req.app.get('io'), context);
  else if (req.params.action === 'payment') await bookingService.collectCounterPayment(booking._id, { _id: ownerId, role: 'owner' }, null, context);
  else throw new ApiError(400, 'Unknown appointment action.');
  notify(req, context.business._id);
  res.json({ message: 'Booking updated.' });
}));
router.get('/prescriptions', allowRoles('doctor', 'customer', 'admin'), asyncHandler(async (req, res) => {
  const filter = prescriptionFilter(req.user);
  if (req.query.booking) filter.booking = validId(req.query.booking);
  const prescriptions = await Prescription.find(filter).sort({ createdAt: -1 }).select('-__v');
  res.json({ data: { prescriptions: prescriptions.map(readPrescription) } });
}));
router.post('/prescriptions', allowRoles('doctor', 'admin'), asyncHandler(async (req, res) => {
  const context = await doctorContext(req.user);
  const booking = await Booking.findById(validId(req.body.bookingId)).populate('userId', 'name');
  requireAssigned(booking, context);
  if (!await isBusinessSubscriptionActive(context.business)) throw new ApiError(403, 'Clinic subscription inactive.');
  if (!['serving', 'completed', 'in-progress'].includes(booking.status)) throw new ApiError(400, 'Start the consultation before saving a prescription.');
  const fields = {};
  for (const key of ['symptoms', 'diagnosis', 'medications', 'investigations', 'advice', 'followUp']) {
    if (req.body[key] !== undefined && typeof req.body[key] !== 'string') throw new ApiError(400, 'Enter prescription fields as text.');
    fields[key] = (req.body[key] || '').trim();
    if (fields[key].length > (key === 'followUp' ? 2000 : 10000)) throw new ApiError(400, 'Prescription text is too long.');
  }
  if (!fields.diagnosis) throw new ApiError(400, 'Enter the diagnosis.');
  const reminder = scheduleFollowUp(req.body.followUpDate);
  const whatsappVisitNotice = reminder.reminderNextRunAt && scheduleVisitNotice(reminder.reminderNextRunAt, reminder.reminderExpiresAt);
  try {
    const notification = req.app.locals.whatsapp?.config.enabled ? schedulePrescriptionNotification() : undefined;
    const prescription = await Prescription.create({ ...fields, ...reminder, whatsappVisitNotice, whatsappNotification: notification, booking: booking._id, business: context.business._id, doctor: req.user._id, patient: booking.userId._id, doctorName: context.staff.name, doctorId: context.staff.doctorId, patientName: booking.userId.name, clinicName: context.business.name });
    res.status(201).json({ data: { prescription: readPrescription(prescription), whatsappNotification: notification ? 'queued' : 'disabled' } });
  } catch (error) { if (error.code === 11000) throw new ApiError(409, 'A prescription is already saved for this consultation.'); throw error; }
}));
router.get('/prescriptions/:id/notification', allowRoles('doctor', 'admin'), asyncHandler(async (req, res) => {
  const context = await doctorContext(req.user);
  const record = await Prescription.findOne({
    _id: validId(req.params.id), doctor: req.user._id, business: context.business._id,
  }).select('_id +whatsappNotification');
  if (!record) throw new ApiError(404, 'Prescription not found.');
  res.json({ data: { status: await prescriptionDeliveryStatus(record) || 'disabled' } });
}));
router.get('/prescriptions/:id/pdf', allowRoles('doctor', 'customer', 'admin'), asyncHandler(async (req, res) => {
  const prescription = await Prescription.findOne({ _id: validId(req.params.id), ...prescriptionFilter(req.user) });
  if (!prescription) throw new ApiError(404, 'Prescription not found.');
  const pdf = await prescriptionPdf(readPrescription(prescription));
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="prescription-${prescription._id}.pdf"`, 'X-Content-Type-Options': 'nosniff' });
  res.send(pdf);
}));
export default router;
