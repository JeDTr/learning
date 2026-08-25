const path = require('path');
const http = require('http');
const os = require('os');
const { URL } = require('url');
const express = require('express');
const { WebSocketServer } = require('ws');

const { USERS } = require('./users');
const { saveMessage, getHistory } = require('./db');
const { wsClients, addClient, removeClient, localCount, sendToLocal } = require('./clients');
const { applyPresence, isOnline } = require('./presence');
const { connectBus } = require('./bus');

const VARIANT = 'kafka';
const INSTANCE_ID = process.env.INSTANCE_ID || os.hostname();

async function main() {
  const bus = await connectBus(INSTANCE_ID, {
    // Broadcast pattern: MOI instance nhan MOI event. Instance tu quyet dinh
    // co client cuc bo lien quan hay khong, roi moi day xuong browser.
    onMessage: (msg) => {
      if (localCount(msg.recipientId) > 0) {
        sendToLocal(msg.recipientId, { event: 'message', message: msg });
      }
    },
    onTyping: (t) => {
      if (localCount(t.to) > 0) {
        sendToLocal(t.to, { event: 'typing', from: t.from });
      }
    },
    onPresence: (p) => {
      const online = applyPresence(p);
      for (const userId of wsClients.keys()) {
        sendToLocal(userId, { event: 'presence', userId: p.userId, online });
      }
    },
  });

  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/health', (req, res) => res.json({ ok: true, instanceId: INSTANCE_ID, variant: VARIANT }));
  app.get('/api/instance', (req, res) => res.json({ instanceId: INSTANCE_ID, variant: VARIANT }));
  app.get('/api/users', (req, res) => res.json(USERS));
  app.get('/api/presence', (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    res.json({ userId, online: isOnline(userId) });
  });
  app.get('/api/messages', (req, res) => {
    const { me, with: withUser } = req.query;
    if (!me || !withUser) return res.status(400).json({ error: 'me and with are required' });
    res.json(getHistory(me, withUser, 50));
  });
  app.post('/api/messages', async (req, res) => {
    const { me, to, body } = req.body || {};
    if (!me || !to || !body || !body.trim()) {
      return res.status(400).json({ error: 'me, to, body are required' });
    }
    if (!USERS.some((u) => u.id === me) || !USERS.some((u) => u.id === to)) {
      return res.status(400).json({ error: 'unknown user' });
    }
    const message = saveMessage({ senderId: me, recipientId: to, body: body.trim() });
    await bus.publishMessage(message);
    res.status(201).json(message);
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname, searchParams } = new URL(req.url, 'http://localhost');
    if (pathname !== '/ws/chat') return socket.destroy();
    const userId = searchParams.get('userId');
    if (!userId || !USERS.some((u) => u.id === userId)) return socket.destroy();
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.userId = userId;
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws) => {
    const { userId } = ws;
    const wasConnected = localCount(userId) > 0;
    addClient(userId, ws);
    console.log(`[ws] ${userId} connected -> instance ${INSTANCE_ID} (local=${localCount(userId)})`);

    if (!wasConnected) {
      bus.publishPresence({ userId, instanceId: INSTANCE_ID, online: true });
      if (bus.subscribeUser) bus.subscribeUser(userId);
    }

    ws.send(JSON.stringify({ event: 'welcome', instanceId: INSTANCE_ID, variant: VARIANT }));

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw);
        if (data.type === 'typing' && data.to) {
          bus.publishTyping({ from: userId, to: data.to });
        }
      } catch (err) {
        console.error('[ws] message khong hop le:', err.message);
      }
    });

    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', () => {
      removeClient(userId, ws);
      console.log(`[ws] ${userId} disconnected khoi instance ${INSTANCE_ID}`);
      if (localCount(userId) === 0) {
        bus.publishPresence({ userId, instanceId: INSTANCE_ID, online: false });
        if (bus.unsubscribeUser) bus.unsubscribeUser(userId);
      }
    });
  });

  const pingInterval = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`[${INSTANCE_ID}] (${VARIANT}) listening on http://localhost:${PORT}`);
  });

  async function shutdown() {
    console.log(`[${INSTANCE_ID}] shutting down...`);
    clearInterval(pingInterval);
    server.close(async () => {
      await bus.close();
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
