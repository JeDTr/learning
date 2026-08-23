const { WebSocketServer } = require('ws');
const { URL } = require('url');
const { wsClients, addClient, removeClient, hasAnyConnection } = require('./clients');
const { registerPresence, unregisterPresence } = require('./presence');
const { getUndelivered, markDelivered } = require('./inbox');

function attachWebSocket(server, { redis, instanceId }) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname, searchParams } = new URL(req.url, 'http://localhost');
    if (pathname !== '/ws/notifications') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.userId = searchParams.get('userId') || 'anonymous';
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws) => {
    const { userId } = ws;

    const wasConnected = hasAnyConnection(userId);
    addClient(wsClients, userId, ws);
    console.log(`[ws] connected userId=${userId}, total=${wsClients.get(userId).size}`);

    if (!wasConnected) {
      registerPresence(redis, userId, instanceId).catch((err) =>
        console.error('[presence] register failed:', err.message)
      );
      console.log(`[presence] ${userId} -> ${instanceId} (registered via WS)`);
    }

    ws.send(JSON.stringify({ event: 'welcome', message: `Connected as ${userId} on ${instanceId}` }));

    // gui lai cac notification bi lo trong luc user offline, luu san trong inbox
    const missed = getUndelivered(userId);
    if (missed.length > 0) {
      for (const n of missed) {
        ws.send(JSON.stringify({ event: 'notification', notification: { ...n, replayed: true } }));
      }
      markDelivered(missed.map((n) => n.id));
      console.log(`[inbox] replay ${missed.length} notification cho userId=${userId} qua WS`);
    }

    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', () => {
      removeClient(wsClients, userId, ws);
      console.log(`[ws] disconnected userId=${userId}`);

      if (!hasAnyConnection(userId)) {
        unregisterPresence(redis, userId, instanceId).catch((err) =>
          console.error('[presence] unregister failed:', err.message)
        );
        console.log(`[presence] ${userId} -> ${instanceId} (unregistered, no more connections)`);
      }
    });

    ws.on('error', (err) => {
      console.error('[ws] error:', err.message);
    });
  });

  // ping/pong de phat hien va don ket noi chet (client mat mang khong close sach)
  const interval = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws.isAlive === false) {
        ws.terminate();
        continue;
      }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  return wss;
}

module.exports = { attachWebSocket };
