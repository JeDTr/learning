const { sseClients, addClient, removeClient, hasAnyConnection } = require('./clients');
const { registerPresence, unregisterPresence } = require('./presence');
const { getUndelivered, markDelivered } = require('./inbox');

function createSSEHandler({ redis, instanceId }) {
  return function handleSSE(req, res) {
    const userId = req.query.userId || 'anonymous';

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      // tat buffering cua nginx/proxy neu co, de event ban ra ngay lap tuc
      'X-Accel-Buffering': 'no',
    });
    // goi y trinh duyet cho 2s truoc khi tu dong reconnect neu mat ket noi
    res.write('retry: 2000\n\n');

    const wasConnected = hasAnyConnection(userId);
    addClient(sseClients, userId, res);
    console.log(`[sse] connected userId=${userId}, total=${sseClients.get(userId).size}`);

    if (!wasConnected) {
      registerPresence(redis, userId, instanceId).catch((err) =>
        console.error('[presence] register failed:', err.message)
      );
      console.log(`[presence] ${userId} -> ${instanceId} (registered via SSE)`);
    }

    // gui lai cac notification bi lo trong luc user offline, luu san trong inbox
    const missed = getUndelivered(userId);
    if (missed.length > 0) {
      for (const n of missed) sendSSE(res, { ...n, replayed: true });
      markDelivered(missed.map((n) => n.id));
      console.log(`[inbox] replay ${missed.length} notification cho userId=${userId} qua SSE`);
    }

    // giu ket noi song, tranh bi proxy/timeout dong sau vai chuc giay im lang
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      removeClient(sseClients, userId, res);
      console.log(`[sse] disconnected userId=${userId}`);

      if (!hasAnyConnection(userId)) {
        unregisterPresence(redis, userId, instanceId).catch((err) =>
          console.error('[presence] unregister failed:', err.message)
        );
        console.log(`[presence] ${userId} -> ${instanceId} (unregistered, no more connections)`);
      }
    });
  };
}

function sendSSE(res, notification) {
  res.write('event: notification\n');
  res.write(`data: ${JSON.stringify(notification)}\n\n`);
}

module.exports = { createSSEHandler, sendSSE };
