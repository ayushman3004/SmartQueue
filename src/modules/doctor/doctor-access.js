import Business from '../business/business.model.js';
import ApiError from '../../../utils/ApiError.js';
import { normalizeServiceCategory } from '../../utils/customerService.js';

export const ref = value => String(value?._id || value || '');
export const isClinic = business => normalizeServiceCategory(business?.category) === 'clinic';

export async function doctorContext(user) {
  if (user?.role !== 'doctor' || user.doctorAccess?.status !== 'ACTIVE') throw new ApiError(403, 'Doctor access is disabled. Contact your business owner.');
  const business = await Business.findById(user.doctorAccess.businessId);
  const staff = business?.staff?.find(member => ref(member._id) === ref(user.doctorAccess.staffId));
  if (!business || !isClinic(business) || business.approvalStatus !== 'approved' || !staff || staff.email?.toLowerCase() !== user.email || !staff.doctorId || staff.doctorId !== user.doctorAccess.doctorId) throw new ApiError(403, 'Doctor access is no longer valid. Contact your business owner.');
  return { business, staff };
}

export function isAssignedToDoctor(record, context) {
  const assigned = record?.assignedStaff;
  if (assigned?.staffId) return ref(assigned.staffId) === ref(context.staff._id);
  // Support older visits only when their staff name identifies exactly one roster member.
  const staffId = ref(context.staff._id);
  const issuedAt = /^[a-f0-9]{24}$/i.test(staffId) ? Number.parseInt(staffId.slice(0, 8), 16) * 1000 : 0;
  const assignedAt = new Date(record?.joinedAt || record?.createdAt || 0).getTime();
  if (!assignedAt || assignedAt < issuedAt) return false;
  const name = String(assigned?.name || '').trim().toLowerCase();
  return Boolean(name && name === context.staff.name.trim().toLowerCase() && context.business.staff.filter(member => member.name.trim().toLowerCase() === name).length === 1);
}

export function requireAssigned(record, context) {
  if (!record || !isAssignedToDoctor(record, context) || (record.businessId && ref(record.businessId) !== ref(context.business._id))) throw new ApiError(403, 'This patient is not assigned to you.');
}

export function prescriptionFilter(user) {
  if (user.role === 'doctor') return { doctor: user._id };
  if (user.role === 'customer') return { patient: user._id };
  throw new ApiError(403, 'Prescriptions are private to the doctor and patient.');
}
