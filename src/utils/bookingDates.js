// Compare calendar days in the venue's timezone, independent of the browser/server timezone.
export const getBusinessDate = (value, business = {}) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: business.operatingHours?.timezone || 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (type) => parts.find((p) => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};

const addDays = (date, days) => {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
};

export const getBookingDateRange = (business = {}, now = new Date()) => {
  const settings = business.bookingSettings || {};
  const configuredDays = Number(settings.maxAdvanceBookingDays);
  const maxAdvanceDays = Number.isFinite(configuredDays) && configuredDays >= 1
    ? Math.min(90, Math.floor(configuredDays)) : 14;
  const today = getBusinessDate(now, business);
  return {
    today,
    minDate: addDays(today, settings.allowSameDayBooking === false ? 1 : 0),
    maxDate: addDays(today, maxAdvanceDays),
    maxAdvanceDays,
  };
};

export const getBookingDateError = (date, business = {}, now = new Date()) => {
  if (business.bookingSettings?.enableAppointments === false) {
    return 'Appointment booking is currently disabled for this business';
  }
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
      new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    return 'Invalid booking date';
  }
  const { today, minDate, maxDate, maxAdvanceDays } = getBookingDateRange(business, now);
  if (date < today) return 'Appointments cannot be booked in the past';
  if (date < minDate) return 'Same-day booking is not permitted by this business';
  if (date > maxDate) return `Appointments cannot be booked more than ${maxAdvanceDays} days in advance`;
  return null;
};
