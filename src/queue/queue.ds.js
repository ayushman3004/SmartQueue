class QueueNode {
  constructor({ userId, serviceTime, serviceType, joinedAt }) {
    this.userId = userId;
    this.serviceTime = serviceTime; // in minutes
    this.serviceType = serviceType || "general";
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

  // 🧪 Auto-remove finished services
  cleanup() {
    let wasCleaned = false;
    // Loop until the head is not serving or the current head still has time left
    while (this.head && this.head.status === "serving") {
      const now = new Date();
      const endTime = new Date(
        this.head.estimatedStartTime.getTime() + this.head.serviceTime * 60000
      );

      if (now > endTime) {
        console.log(`🕒 Auto-removing finished service for user: ${this.head.userId}`);
        this.dequeue();
        wasCleaned = true;
      } else {
        break; // head still has time, stop checking
      }
    }
    return wasCleaned;
  }

  // 🔁 Recalculate ETA for whole queue
  recalculate() {
    let current = this.head;
    let time = new Date();

    // The serving user's start time is fixed to when they actually started.
    // We only recalculate for waiting users relative to the serving user's end time.
    if (current && current.status === "serving" && current.estimatedStartTime) {
      time = new Date(current.estimatedStartTime);
    }

    const BUFFER = 15; // 15-minute buffer between slots as requested

    while (current) {
      current.estimatedStartTime = new Date(time);
      // Next person starts after current person ends + 15 min buffer
      time = new Date(time.getTime() + (current.serviceTime + BUFFER) * 60000);
      current = current.next;
    }
  }

  // ➕ JOIN
  enqueue(user) {
    if (this.map.has(user.userId)) {
      throw new Error("User already in queue");
    }

    const node = new QueueNode(user);
    node.estimatedStartTime = user.estimatedStartTime || null;

    if (!this.head) {
      this.head = this.tail = node;
      node.status = "serving";
      // If just starting, set to now
      if (!node.estimatedStartTime) node.estimatedStartTime = new Date();
    } else {
      this.tail.next = node;
      node.prev = this.tail;
      this.tail = node;
    }

    if (user.userId) {
      this.map.set(user.userId.toString(), node);
    }
    this.recalculate();
  }

  // ⏭️ NEXT
  dequeue() {
    if (!this.head) return;

    this.map.delete(this.head.userId.toString());

    this.head = this.head.next;

    if (this.head) {
      this.head.prev = null;
      this.head.status = "serving";
      // New head starts now
      this.head.estimatedStartTime = new Date();
    } else {
      this.tail = null;
    }

    this.recalculate();
  }

  // ❌ LEAVE
  remove(userId) {
    const node = this.map.get(userId.toString());
    if (!node) return;

    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;

    if (node === this.head) {
      this.head = node.next;
      if (this.head) {
        this.head.status = "serving";
        this.head.estimatedStartTime = new Date();
      }
    }
    if (node === this.tail) this.tail = node.prev;

    this.map.delete(userId.toString());
    this.recalculate();
  }

  // 📤 Convert → DB
  toArray() {
    const arr = [];
    let current = this.head;

    while (current) {
      arr.push({
        userId: current.userId,
        status: current.status,
        serviceTime: current.serviceTime,
        serviceType: current.serviceType,
        estimatedStartTime: current.estimatedStartTime,
        joinedAt: current.joinedAt,
      });
      current = current.next;
    }

    return arr;
  }

  // 📥 Load from DB
  static fromArray(users) {
    const queue = new QueueDS();

    users.forEach((u) => {
      const node = new QueueNode(u);
      node.status = u.status;
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