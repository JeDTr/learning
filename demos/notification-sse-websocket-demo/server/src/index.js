const path = require('path');
const http = require('http');
const os = require('os');
const express = require('express');

const { createRedisClient, createSubscriber, channelForInstance } = require('./redisClient');
const { createSSEHandler, sendSSE } = require('./sse');
const { attachWebSocket } = require('./websocket');
const { sseClients, wsClients } = require('./clients');
const { lookupInstances, startHeartbeat } = require('./presence');
const { saveToInbox, getUndelivered } = require('./inbox');

const INSTANCE_ID = process.env.INSTANCE_ID || os.hostname();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// dung 1 connection cho ca publish lan cac lenh presence (SADD/SREM/SMEMBERS),
// vi day khong phai connection subscribe nen van chay lenh thuong binh thuong
const redis = createRedisClient();

// tu bao con song dinh ky; neu process nay chet dot ngot, key het TTL va
// lookupInstances() o cac instance khac se tu don presence tro toi no
const stopHeartbeat = startHeartbeat(redis, INSTANCE_ID);

app.get('/api/instance', (req, res) => res.json({ instanceId: INSTANCE_ID }));

app.get('/sse/notifications', createSSEHandler({ redis, instanceId: INSTANCE_ID }));

app.post('/api/notifications', async (req, res) => {
  const { userId, title, message, type } = req.body || {};
  if (!userId || !title) {
    return res.status(400).json({ error: 'userId and title are required' });
  }

  const notification = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    title,
    message: message || '',
    type: type || 'info',
    createdAt: new Date().toISOString(),
  };

  // presence lookup: chi hoi dung nhung instance dang giu ket noi cua user nay,
  // roi publish thang vao kenh rieng cua tung instance do -> khong broadcast
  // cho toan bo instance nhu cach lam pub/sub don gian truoc day
  const targetInstances = await lookupInstances(redis, userId);

  if (targetInstances.length === 0) {
    // user offline o moi instance -> pub/sub khong con y nghia (khong ai lang
    // nghe), luu vao inbox ben (SQLite) de gui lai luc user ket noi lan sau
    saveToInbox(notification);
    console.log(`[dispatch] ${notification.id} -> userId=${userId}: user offline, da luu vao inbox`);
  } else {
    const payload = JSON.stringify(notification);
    await Promise.all(
      targetInstances.map((instanceId) => redis.publish(channelForInstance(instanceId), payload))
    );
    console.log(`[dispatch] ${notification.id} -> userId=${userId}: routed toi instance [${targetInstances.join(', ')}]`);
  }

  res.status(201).json(notification);
});

app.get('/api/inbox', (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  res.json({ userId, undelivered: getUndelivered(userId) });
});

app.get('/health', (req, res) => res.json({ ok: true, instanceId: INSTANCE_ID }));

const server = http.createServer(app);
attachWebSocket(server, { redis, instanceId: INSTANCE_ID });

// instance nay chi subscribe kenh rieng cua chinh no -> chi nhan dung nhung
// notification da duoc route toi day, khong nhan "rac" cua instance khac
createSubscriber(channelForInstance(INSTANCE_ID), (notification) => {
  const { userId, id } = notification;

  const sseSet = sseClients.get(userId);
  if (sseSet) {
    for (const res of sseSet) sendSSE(res, notification);
  }

  const wsSet = wsClients.get(userId);
  if (wsSet) {
    const payload = JSON.stringify({ event: 'notification', notification });
    for (const ws of wsSet) {
      if (ws.readyState === ws.OPEN) ws.send(payload);
    }
  }

  console.log(
    `[${INSTANCE_ID}] delivered ${id} -> userId=${userId} (sse=${sseSet?.size || 0}, ws=${wsSet?.size || 0})`
  );
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`[${INSTANCE_ID}] listening on http://localhost:${PORT}`);
});

function shutdown() {
  console.log(`[${INSTANCE_ID}] shutting down...`);
  stopHeartbeat();
  server.close(() => {
    redis.quit();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
