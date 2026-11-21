import Business from '../business/business.model.js';
import ApiError from '../../../utils/ApiError.js';

// One reusable pair of private test venues per administrator; no extra user accounts.
export async function ensureAdminWorkspace(user) {
  if (user?.role !== 'admin') throw new ApiError(403, 'Super admin access required.');
  const venues = [];
  for (const category of ['clinic', 'salon']) {
    const service = category === 'clinic' ? 'Test consultation' : 'Test haircut';
    const doctor = category === 'clinic';
    const query = { owner: user._id, adminTestKind: category };
    let business;
    try {
      business = await Business.findOneAndUpdate(query, { $setOnInsert: {
        ...query,
        name: `ServeQ Test ${doctor ? 'Clinic' : 'Salon'}`,
        description: 'Private super admin test workspace.',
        category, categorySelectedAt: new Date(), approvalStatus: 'approved',
        location: 'Test workspace', isOpen: true, isActive: true,
        subscription: { plan: 'PRO', status: 'ACTIVE', amount: 0, expiresAt: null },
        serviceTypes: [service],
        services: [{ name: service, duration: 10, price: 0 }],
        staff: [{ name: doctor ? 'Test doctor' : 'Test stylist', role: doctor ? 'Doctor' : 'Stylist',
          email: user.email, doctorId: doctor ? 'ADMIN-TEST' : '', assignedServices: [service] }],
        'onboarding.status': 'COMPLETED',
      } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
      business = await Business.findOne(query);
      if (!business) throw error;
    }
    venues.push(business);
  }
  return { clinic: venues[0], salon: venues[1] };
}

export function assertTestVenueAccess(business, userId) {
  if (business?.adminTestKind && String(business.owner?._id || business.owner) !== String(userId || '')) {
    throw new ApiError(404, 'Business not found');
  }
}
