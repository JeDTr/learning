const path = require('path');
const http = require('http');
const os = require('os');
const express = require('express');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');

const { USERS } = require('./users');
const { saveMessage, getHistory } = require('./db');

const VARIANT = 'socketio-redis-pubsub';
const INSTANCE_ID = process.env.INSTANCE_ID || os.hostname();
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function roomOf(userId) {
  return `user:${userId}`;
}

async function main() {
  // pubClient dung de publish (adapter can) + subClient rieng de subscribe -
  // day la cap doi lien ket chuan cua @socket.io/redis-adapter.
  const pubClient = new Redis(REDIS_URL);
  const subClient = pubClient.duplicate();

  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/health', (req, res) => res.json({ ok: true, instanceId: INSTANCE_ID, variant: VARIANT }));
  app.get('/api/instance', (req, res) => res.json({ instanceId: INSTANCE_ID, variant: VARIANT }));
  app.get('/api/users', (req, res) => res.json(USERS));
  app.get('/api/messages', (req, res) => {
    const { me, with: withUser } = req.query;
    if (!me || !withUser) return res.status(400).json({ error: 'me and with are required' });
    res.json(getHistory(me, withUser, 50));
  });

  const server = http.createServer(app);
  const io = new Server(server, { path: '/socket.io' });

  // Redis adapter: bien io.to(room).emit(...) thanh event duoc phat qua TOAN
  // BO instance trong cluster bang Redis pub/sub duoi nen. Day la diem khac
  // biet lon nhat so voi 2 bien the redis-streams/kafka o cac folder ke ben:
  // khong can tu viet channel rieng, khong can tu gom presence bang tay -
  // io.in(room).fetchSockets() (dung ben duoi) da tu hoi ca cluster ho minh.
  io.adapter(createAdapter(pubClient, subClient));

  app.get('/api/presence', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const sockets = await io.in(roomOf(userId)).fetchSockets();
    res.json({ userId, online: sockets.length > 0 });
  });

  app.post('/api/messages', (req, res) => {
    const { me, to, body } = req.body || {};
    if (!me || !to || !body || !body.trim()) {
      return res.status(400).json({ error: 'me, to, body are required' });
    }
    if (!USERS.some((u) => u.id === me) || !USERS.some((u) => u.id === to)) {
      return res.status(400).json({ error: 'unknown user' });
    }
    const message = saveMessage({ senderId: me, recipientId: to, body: body.trim() });
    // Neu recipient dang giu ket noi o BAT KY instance nao trong cluster (ke
    // ca instance khac instance nay), dong nay la du de phat toi dung ho -
    // khong pub/sub thu cong, khong presence lookup thu cong.
    io.to(roomOf(to)).emit('chat:message', message);
    res.status(201).json(message);
  });

  io.on('connection', async (socket) => {
    const userId = socket.handshake.query.userId;
    if (!userId || !USERS.some((u) => u.id === userId)) {
      socket.disconnect(true);
      return;
    }
    socket.data.userId = userId;
    await socket.join(roomOf(userId));
    console.log(`[socket.io] ${userId} connected -> instance ${INSTANCE_ID} (socket ${socket.id})`);

    socket.emit('welcome', { instanceId: INSTANCE_ID, variant: VARIANT });
    // presence: bao toan cluster user nay vua online - moi client dang mo (du
    // o instance nao) deu nhan duoc qua chinh adapter nay, khong can channel rieng.
    io.emit('presence', { userId, online: true });

    socket.on('typing', ({ to }) => {
      if (!to) return;
      io.to(roomOf(to)).emit('typing', { from: userId });
    });

    socket.on('disconnect', async () => {
      console.log(`[socket.io] ${userId} disconnected khoi instance ${INSTANCE_ID}`);
      // chi bao offline neu KHONG CON socket nao (o bat ky instance nao) giu
      // room nay nua - vi user co the dang mo tab khac tro toi instance khac.
      const remaining = await io.in(roomOf(userId)).fetchSockets();
      if (remaining.length === 0) {
        io.emit('presence', { userId, online: false });
      }
    });
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`[${INSTANCE_ID}] (${VARIANT}) listening on http://localhost:${PORT}`);
  });

  function shutdown() {
    console.log(`[${INSTANCE_ID}] shutting down...`);
    server.close(() => {
      pubClient.quit();
      subClient.quit();
      process.exit(0);
    });
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('fatal:', err);
  process.exit(1);
});
