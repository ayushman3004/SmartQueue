class QueueNode {
  constructor({ userId, bookingId, serviceTime, serviceType, joinedAt, pricingLabel, paidAmount, paymentMethod, paymentStatus, services, assignedStaff }) {
    this.userId = userId;
    this.bookingId = bookingId || null;
    this.serviceTime = serviceTime; // in minutes
    this.serviceType = serviceType || "general";
    this.services = Array.isArray(services) ? services : [];
    this.assignedStaff = assignedStaff || null;
    this.pricingLabel = pricingLabel || "";
    this.paidAmount = paidAmount || 0;
    this.paymentMethod = paymentMethod || "counter";
    this.paymentStatus = paymentStatus || "pending";
    this.joinedAt = joinedAt || new Date();

    this.status = "waiting"; // waiting | serving | done
    this.estimatedStartTime = null;

    this.next = null;
    this.prev = null;
  }
}

class QueueDS {
  constructor() {
    this.head = null; // serving
    this.tail = null;
    this.map = new Map(); // userId -> node
  }

  //  Auto-remove abandoned/stale services (older than 12 hours)
  cleanup(maxAgeHours = 12) {
    let wasCleaned = false;
    const now = new Date();
    const cutoff = new Date(now.getTime() - maxAgeHours * 60 * 60 * 1000);

    // Only clean up entries that have been abandoned from earlier days (older than cutoff)
    while (this.head) {
      const entryTime = this.head.joinedAt
        ? new Date(this.head.joinedAt)
        : this.head.estimatedStartTime
        ? new Date(this.head.estimatedStartTime)
        : null;

      if (entryTime && entryTime < cutoff) {
        console.log(` Auto-removing stale/abandoned queue entry for user: ${this.head.userId}`);
        this.dequeue();
        wasCleaned = true;
      } else {
        break; // active patron within normal hours, keep in queue
      }
    }
    return wasCleaned;
  }

  //  Recalculate ETA and status per staff member's personal queue
  recalculate() {
    const BUFFER = 15; // 15-minute buffer between slots as requested
    const now = new Date();

    // Track per-staff running finish time: staffKey -> finishTimeMs
    const staffFinishMap = new Map();

    let current = this.head;
    while (current) {
      const staffKey = (current.assignedStaff?.name || "__unassigned__").toLowerCase().trim();

      if (!staffFinishMap.has(staffKey)) {
        // First active patron in line for this specific staff member is serving
        current.status = "serving";
        if (!current.estimatedStartTime) {
          current.estimatedStartTime = new Date(now);
        } else {
          current.estimatedStartTime = new Date(current.estimatedStartTime);
        }

        const duration = Math.max(1, Number(current.serviceTime) || 15);
        const finishMs = current.estimatedStartTime.getTime() + (duration + BUFFER) * 60000;
        staffFinishMap.set(staffKey, finishMs);
      } else {
        // Subsequent patrons for this specific staff member wait in their personal queue
        current.status = "waiting";
        const previousFinishMs = staffFinishMap.get(staffKey);
        const startMs = Math.max(now.getTime(), previousFinishMs);
        current.estimatedStartTime = new Date(startMs);

        const duration = Math.max(1, Number(current.serviceTime) || 15);
        const nextFinishMs = startMs + (duration + BUFFER) * 60000;
        staffFinishMap.set(staffKey, nextFinishMs);
      }

      current = current.next;
    }
  }

  //  JOIN
  enqueue(user) {
    const uId = (user.userId?._id || user.userId)?.toString();
    if (uId && this.map.has(uId)) {
      throw new Error("User already in queue");
    }

    const node = new QueueNode(user);
    node.estimatedStartTime = user.estimatedStartTime ? new Date(user.estimatedStartTime) : null;
    node.status = user.status || "waiting";

    if (!this.head) {
      this.head = this.tail = node;
    } else {
      this.tail.next = node;
      node.prev = this.tail;
      this.tail = node;
    }

    if (uId) {
      this.map.set(uId, node);
    }
    this.recalculate();
  }

  // ⏭️ NEXT
  dequeue() {
    if (!this.head) return;

    const uId = (this.head.userId?._id || this.head.userId)?.toString();
    if (uId) {
      this.map.delete(uId);
    }

    this.head = this.head.next;

    if (this.head) {
      this.head.prev = null;
    } else {
      this.tail = null;
    }

    this.recalculate();
  }

  //  LEAVE / COMPLETE SPECIFIC USER
  remove(userId) {
    if (!userId) return null;
    const uId = (userId._id || userId).toString();
    const node = this.map.get(uId);
    if (!node) return null;

    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }

    this.map.delete(uId);
    this.recalculate();
    return node;
  }

  //  Convert → DB
  toArray() {
    const arr = [];
    let current = this.head;

    while (current) {
      arr.push({
        userId: current.userId,
        bookingId: current.bookingId || null,
        status: current.status,
        serviceTime: current.serviceTime,
        serviceType: current.serviceType,
        services: current.services || [],
        assignedStaff: current.assignedStaff || null,
        pricingLabel: current.pricingLabel,
        paidAmount: current.paidAmount,
        paymentMethod: current.paymentMethod || "counter",
        paymentStatus: current.paymentStatus || "pending",
        estimatedStartTime: current.estimatedStartTime,
        joinedAt: current.joinedAt,
      });
      current = current.next;
    }

    return arr;
  }

  //  Load from DB
  static fromArray(users) {
    const queue = new QueueDS();

    users.forEach((u) => {
      const node = new QueueNode(u);
      node.bookingId = u.bookingId || null;
      node.status = u.status;
      node.services = u.services || [];
      node.assignedStaff = u.assignedStaff || null;
      node.pricingLabel = u.pricingLabel || "";
      node.paidAmount = u.paidAmount || 0;
      node.paymentMethod = u.paymentMethod || "counter";
      node.paymentStatus = u.paymentStatus || "pending";
      node.estimatedStartTime = u.estimatedStartTime ? new Date(u.estimatedStartTime) : null;

      if (!queue.head) {
        queue.head = queue.tail = node;
      } else {
        queue.tail.next = node;
        node.prev = queue.tail;
        queue.tail = node;
      }

      if (u.userId) {
        const idStr = (u.userId._id || u.userId).toString();
        queue.map.set(idStr, node);
      }
    });

    queue.recalculate();
    return queue;
  }
}

export default QueueDS;