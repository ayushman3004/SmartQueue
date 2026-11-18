// getMyBookings already merges live queues with persisted bookings. Use that response for
// history status and counts, rather than overlaying an older business-discovery queue snapshot.
export const buildHistoryRecords = (bookings, sortOrder = 'newest') => bookings.map((booking) => {
  const status = booking.status === 'in-progress' ? 'serving' : booking.status;
  const isLiveQueue = Boolean(booking.isLiveQueue || booking.entryType === 'live_queue' ||
    booking.notes?.includes('Live Queue') || ['waiting', 'serving'].includes(status));
  return {
    ...booking,
    status,
    entryType: isLiveQueue ? 'live_queue' : 'appointment',
    isLiveQueue,
    isAppointment: !isLiveQueue,
    isServing: status === 'serving',
    businessName: booking.businessId?.name || 'Local Venue',
    businessCategory: booking.businessId?.category || 'clinic',
    paidAmount: booking.paidAmount || booking.price || 0,
  };
}).sort((a, b) => {
  const timeA = new Date(a.startTime || a.createdAt || 0).getTime();
  const timeB = new Date(b.startTime || b.createdAt || 0).getTime();
  return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
});
