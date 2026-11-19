import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { io as connectClient } from 'socket.io-client';
import User from '../src/modules/auth/auth.model.js';
import Business from '../src/modules/business/business.model.js';
import Booking from '../src/booking/booking.model.js';
import { initSocket, isUserOnline, getOnlineHubIds } from '../realtime/socket.js';

const customer = '111111111111111111111111';
const other = '222222222222222222222222';
const owner = '333333333333333333333333';
const admin = '444444444444444444444444';
const venue = '555555555555555555555555';
const bookingId = '666666666666666666666666';
const foreignVenue = '777777777777777777777777';

test('private Socket.IO rooms enforce authorization on actual connections', async t => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'private-socket-regression-secret';
  t.after(() => { if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous; });
  const users = new Map([customer, other, owner, admin].map(id => [id, { _id: id, role: id === owner ? 'owner' : id === admin ? 'admin' : 'user', tokenVersion: 0 }]));
  const businesses = new Map([[venue, { _id: venue, owner, approvalStatus: 'approved' }], [foreignVenue, { _id: foreignVenue, owner: other, approvalStatus: 'approved' }]]);
  t.mock.method(User, 'findById', async id => users.get(String(id)));
  t.mock.method(Business, 'findById', async id => businesses.get(String(id)));
  t.mock.method(Business, 'findOne', async query => {
    const business = businesses.get(String(query._id));
    return business && business.owner === query.owner && business.approvalStatus === query.approvalStatus ? business : null;
  });
  t.mock.method(Booking, 'findById', async id => id === bookingId ? { _id: id, userId: customer, businessId: venue } : null);
  const server = http.createServer();
  const io = new Server(server);
  let maintenance;
  const clock = t.mock.method(globalThis, 'setInterval', callback => { maintenance = callback; return { unref() {} }; });
  initSocket(io);
  clock.mock.restore();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const clients = [];
  t.after(async () => { for (const client of clients) client.disconnect(); await new Promise(resolve => io.close(resolve)); });
  const token = (id, extra = {}) => jwt.sign({ id, tokenVersion: 0, ...extra }, process.env.JWT_SECRET, extra.exp === undefined ? { expiresIn: '1h' } : {});
  const connect = async authToken => {
    const client = connectClient(`http://127.0.0.1:${server.address().port}`, { transports: ['websocket'], forceNew: true, reconnection: false, autoConnect: false, auth: authToken === undefined ? {} : { token: authToken } });
    clients.push(client);
    const outcome = new Promise(resolve => { client.once('connect', () => resolve(null)); client.once('connect_error', resolve); });
    client.connect();
    const error = await outcome;
    return { client, error, socket: io.sockets.sockets.get(client.id) };
  };
  const denied = async (client, event, payload) => {
    const response = once(client, 'error');
    client.emit(event, payload);
    assert.match((await response)[0].message, /Invalid|denied|authorization/);
  };
  const waitRoom = async (socket, room) => {
    for (let n = 0; n < 100 && !socket.rooms.has(room); n++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(socket.rooms.has(room), true, `expected authorized room ${room}`);
  };

  await t.test('guests cannot inject private namespaces through public business IDs', async () => {
    const { client, socket, error } = await connect();
    assert.equal(error, null);
    for (const payload of [undefined, null, [], {}, { businessId: `${venue}:admin` }, { businessId: { $ne: null } }, { businessId: ['x'] }, { businessId: 'user:someone' }]) await denied(client, 'join:room', payload);
    for (const [event, payload] of [['join:admin', { businessId: venue }], ['join:user', { userId: customer }], ['join:booking', { bookingId }]]) await denied(client, event, payload);
    assert.equal([...socket.rooms].some(room => room.endsWith(':admin') || room.startsWith('user:') || room.startsWith('booking:')), false);
    client.emit('join:room', { businessId: venue });
    await waitRoom(socket, `business:${venue}`);
    const received = [];
    client.on('private:test', value => received.push(value));
    io.to(`business:${venue}:admin`).emit('private:test', 'business');
    io.to(`user:${customer}`).emit('private:test', 'user');
    io.to(`booking:${bookingId}`).emit('private:test', 'booking');
    const barrier = once(client, 'barrier'); socket.emit('barrier'); await barrier;
    assert.deepEqual(received, []);
    const disconnected = once(socket, 'disconnect'); client.disconnect(); await disconnected;
  });

  await t.test('invalid, expired, activation and stale credentials fail the handshake', async () => {
    for (const value of ['invalid', { id: customer }, token(customer, { exp: 1 }), token(customer, { purpose: 'activation' }), token(customer, { tokenVersion: 9 }), token('888888888888888888888888')]) {
      const { error } = await connect(value);
      assert.ok(error);
    }
  });

  await t.test('customers receive only their own notifications and bookings', async () => {
    const { client, socket, error } = await connect(token(customer));
    assert.equal(error, null);
    await waitRoom(socket, `user:${customer}`);
    assert.equal(isUserOnline(customer), true);
    await denied(client, 'join:user', { userId: other });
    await denied(client, 'join:admin', { businessId: venue });
    client.emit('join:booking', { bookingId });
    await waitRoom(socket, `booking:${bookingId}`);
    const received = once(client, 'private:test');
    io.to(`booking:${bookingId}`).emit('private:test', 'authorized');
    assert.equal((await received)[0], 'authorized');
    const foreign = await connect(token(other));
    await denied(foreign.client, 'join:booking', { bookingId });
    assert.equal(foreign.socket.rooms.has(`booking:${bookingId}`), false);
  });

  await t.test('owners need an approved owned venue; admins still cannot impersonate users', async () => {
    const own = await connect(token(owner));
    await denied(own.client, 'join:admin', { businessId: foreignVenue });
    own.client.emit('join:admin', { businessId: venue });
    await waitRoom(own.socket, `business:${venue}:admin`);
    assert.ok(getOnlineHubIds().includes(venue));
    own.client.emit('join:booking', { bookingId });
    await waitRoom(own.socket, `booking:${bookingId}`);
    businesses.get(venue).approvalStatus = 'pending';
    await maintenance();
    assert.equal(own.socket.rooms.has(`business:${venue}:admin`), false);
    assert.equal(own.socket.rooms.has(`booking:${bookingId}`), false);
    assert.equal(getOnlineHubIds().includes(venue), false);
    await denied(own.client, 'join:admin', { businessId: venue });
    businesses.get(venue).approvalStatus = 'approved';
    own.client.emit('join:admin', { businessId: venue });
    await waitRoom(own.socket, `business:${venue}:admin`);
    businesses.get(venue).owner = other;
    await denied(own.client, 'join:admin', { businessId: venue });
    assert.equal(own.socket.rooms.has(`business:${venue}:admin`), false);
    businesses.get(venue).owner = owner;
    const staff = await connect(token(admin));
    staff.client.emit('join:admin', { businessId: venue });
    await waitRoom(staff.socket, `business:${venue}:admin`);
    staff.client.emit('join:booking', { bookingId });
    await waitRoom(staff.socket, `booking:${bookingId}`);
    await denied(staff.client, 'join:user', { userId: customer });
    await denied(staff.client, 'join:admin', { businessId: '999999999999999999999999' });
  });

  await t.test('idle sockets lose private access after token version, role and owner state changes', async () => {
    const staff = [...io.sockets.sockets.values()].find(socket => socket.user?.id === admin);
    users.get(admin).role = 'user';
    await maintenance();
    assert.equal(staff.rooms.has(`business:${venue}:admin`), false);
    assert.equal(staff.rooms.has(`booking:${bookingId}`), false);
    users.get(customer).tokenVersion = 1;
    users.get(owner).ownerAccess = { applicationId: 'application', status: 'SUSPENDED' };
    await maintenance();
    assert.equal(isUserOnline(customer), false);
    assert.equal(isUserOnline(owner), false);
    assert.equal([...io.sockets.sockets.values()].some(socket => socket.user?.id === customer || socket.user?.id === owner), false);
  });
});
