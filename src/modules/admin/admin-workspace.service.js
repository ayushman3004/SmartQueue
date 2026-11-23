import Business from '../business/business.model.js';
import ApiError from '../../../utils/ApiError.js';

export async function ensureAdminWorkspace(user) {
  if (user?.role !== 'admin') throw new ApiError(403, 'Super admin access required.');
  const service = 'Test consultation';
  const query = { owner: user._id, adminTestKind: 'clinic' };
  let clinic;
  try {
    clinic = await Business.findOneAndUpdate(query, { $setOnInsert: {
      ...query,
      name: 'ServeQ Test Clinic',
      description: 'Private super admin test workspace.',
      category: 'clinic', categorySelectedAt: new Date(), approvalStatus: 'approved',
      location: 'Test workspace', isOpen: true, isActive: true,
      subscription: { plan: 'PRO', status: 'ACTIVE', amount: 0, expiresAt: null },
      serviceTypes: [service],
      services: [{ name: service, duration: 10, price: 0 }],
      staff: [{ name: 'Test doctor', role: 'Doctor', email: user.email, doctorId: 'ADMIN-TEST', assignedServices: [service] }],
      'onboarding.status': 'COMPLETED',
    } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
  } catch (error) {
    if (error.code !== 11000) throw error;
    clinic = await Business.findOne(query);
    if (!clinic) throw error;
  }
  return { clinic };
}

export function assertTestVenueAccess(business, userId) {
  if (business?.adminTestKind && String(business.owner?._id || business.owner) !== String(userId || '')) {
    throw new ApiError(404, 'Clinic not found');
  }
}
