const refId = value => value?._id || value;

function liveQueueStatus({ status, serviceTime, estimatedStartTime, assignedStaff }) {
  return {
    status,
    serviceTime,
    estimatedStartTime,
    ...(assignedStaff?.name && { assignedStaff: { name: assignedStaff.name, role: assignedStaff.role } }),
  };
}

export function queueRowsForViewer(rows = [], viewerId) {
  return rows.map(row => {
    if (viewerId && String(refId(row.userId)) === String(viewerId)) {
      return { ...(row.toObject?.() ?? row), userId: refId(row.userId) };
    }
    return liveQueueStatus(row);
  });
}

export function queueForViewer(queue, viewerId) {
  return {
    _id: queue._id,
    businessId: queue.businessId,
    users: queueRowsForViewer(queue.users, viewerId),
  };
}

export function queueForOwner(queue) {
  return {
    _id: queue._id,
    businessId: queue.businessId,
    users: queue.users.map(row => ({
      ...liveQueueStatus(row),
      userId: { _id: refId(row.userId), name: row.userId?.name },
      walkIn: row.walkIn,
      paidAmount: row.paidAmount,
      paymentStatus: row.paymentStatus,
    })),
  };
}

export function publishQueue(io, businessId, queue) {
  if (!io || !queue) return;
  const room = io.to(`business:${businessId}`);
  const view = queueForViewer(queue);
  room.emit("queue:update", view);
  room.emit("queue:updated", { businessId, queue: view });
}
