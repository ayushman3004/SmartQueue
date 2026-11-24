const refId = value => value?._id || value;

export function queueRowsForViewer(rows = [], viewerId) {
  return rows.map(row => {
    const { status, serviceTime, estimatedStartTime, assignedStaff } = row;
    if (viewerId && String(refId(row.userId)) === String(viewerId)) {
      return { ...(row.toObject?.() ?? row), userId: refId(row.userId) };
    }
    return {
      status,
      serviceTime,
      estimatedStartTime,
      ...(assignedStaff?.name && { assignedStaff: { name: assignedStaff.name, role: assignedStaff.role } }),
    };
  });
}

export function queueForViewer(queue, viewerId) {
  return {
    _id: queue._id,
    businessId: queue.businessId,
    users: queueRowsForViewer(queue.users, viewerId),
  };
}

export function publishQueue(io, businessId, queue) {
  if (!io || !queue) return;
  const room = io.to(`business:${businessId}`);
  const view = queueForViewer(queue);
  room.emit("queue:update", view);
  room.emit("queue:updated", { businessId, queue: view });
}
