import api from './axios.js';

export const getDoctorDashboard = () => api.get('/doctors/dashboard');
export const getDoctorAccess = business => api.get(`/doctors/owner/${business}`);
export const changeDoctorAccess = (business, staff, action) => api.post(`/doctors/owner/${business}/${staff}/${action}`);
export const changeDoctorPassword = data => api.post('/doctors/password', data);
export const doctorVisitAction = (kind, id, action, data) => api.post(`/doctors/${kind}/${id}/${action}`, data);
export const getPrescriptions = () => api.get('/doctors/prescriptions');
export const getPrescriptionNotification = id => api.get(`/doctors/prescriptions/${id}/notification`);
export const savePrescription = data => api.post('/doctors/prescriptions', data);

export async function downloadPrescription(id) {
  const { data } = await api.get(`/doctors/prescriptions/${id}/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `prescription-${id}.pdf`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const checkDoctorDelivery = (business, staff) => api.get(`/doctors/owner/${business}/${staff}/delivery`);
