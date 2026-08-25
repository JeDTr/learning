// Registry ket noi WebSocket CUC BO cua instance nay, group theo userId (1 user
// co the mo nhieu tab -> nhieu socket, kem ca truong hop mo nhieu tab tro toi
// nhieu instance khac nhau de so sanh).
const wsClients = new Map();

function addClient(userId, ws) {
  if (!wsClients.has(userId)) wsClients.set(userId, new Set());
  wsClients.get(userId).add(ws);
}

function removeClient(userId, ws) {
  const set = wsClients.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) wsClients.delete(userId);
}

function localCount(userId) {
  return wsClients.get(userId)?.size || 0;
}

function sendToLocal(userId, payload) {
  const set = wsClients.get(userId);
  if (!set) return 0;
  const data = JSON.stringify(payload);
  let sent = 0;
  for (const ws of set) {
    if (ws.readyState === ws.OPEN) {
      ws.send(data);
      sent += 1;
    }
  }
  return sent;
}

module.exports = { wsClients, addClient, removeClient, localCount, sendToLocal };
