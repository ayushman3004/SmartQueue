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
    if (!this.head || this.head.status !== "serving") return false;

    const now = new Date();
    const endTime = new Date(
      this.head.estimatedStartTime.getTime() + this.head.serviceTime * 60000
    );

    if (now > endTime) {
      console.log(`🕒 Auto-removing finished service for user: ${this.head.userId}`);
      this.dequeue();
      return true; // something was removed
    }
    return false;
  }

  // 🔁 Recalculate ETA for whole queue
  recalculate() {
    let current = this.head;
    let time = new Date();

    while (current) {
      // If someone is already serving, their start time is fixed to when they started
      // But for this simple DS, we'll just use current time for head
      current.estimatedStartTime = new Date(time);
      time = new Date(time.getTime() + current.serviceTime * 60000);
      current = current.next;
    }
  }

  // ➕ JOIN
  enqueue(user) {
    if (this.map.has(user.userId)) {
      throw new Error("User already in queue");
    }

    const node = new QueueNode(user);

    if (!this.head) {
      this.head = this.tail = node;
      node.status = "serving";
    } else {
      this.tail.next = node;
      node.prev = this.tail;
      this.tail = node;
    }

    this.map.set(user.userId.toString(), node);
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

    if (node === this.head) this.head = node.next;
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

    users.forEach((u, index) => {
      const node = new QueueNode(u);
      node.status = u.status;

      if (!queue.head) {
        queue.head = queue.tail = node;
      } else {
        queue.tail.next = node;
        node.prev = queue.tail;
        queue.tail = node;
      }

      queue.map.set(u.userId.toString(), node);
    });

    queue.recalculate();
    return queue;
  }
}

export default QueueDS;