import ApiError from '../../../utils/ApiError.js';
import { getActiveClinicPlan } from '../subscription/clinic-capacity.service.js';
import { requireAssigned } from './doctor-access.js';

export async function nextServiceStep(visit, expectedStep, doctor) {
  requireAssigned(visit, doctor);
  if ((await getActiveClinicPlan(doctor.business))?.id !== 'PRO') {
    throw new ApiError(403, 'Multi-service sequencing requires an active Pro subscription.');
  }
  const current = visit.serviceStep ?? 0;
  if (!['serving', 'in-progress'].includes(visit.status) || !Number.isInteger(expectedStep) ||
      expectedStep !== current || current >= (visit.services?.length || 0) - 1) {
    throw new ApiError(409, 'There is no matching next service. Refresh the visit and try again.');
  }
  return current + 1;
}
