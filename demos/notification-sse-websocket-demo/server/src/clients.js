// Registry cua cac connection dang mo, group theo userId.
// sseClients: userId -> Set<express.Response>
// wsClients:  userId -> Set<ws.WebSocket>
const sseClients = new Map();
const wsClients = new Map();

function addClient(map, userId, conn) {
  if (!map.has(userId)) map.set(userId, new Set());
  map.get(userId).add(conn);
}

function removeClient(map, userId, conn) {
  const set = map.get(userId);
  if (!set) return;
  set.delete(conn);
  if (set.size === 0) map.delete(userId);
}

function hasAnyConnection(userId) {
  return (sseClients.get(userId)?.size || 0) + (wsClients.get(userId)?.size || 0) > 0;
}

module.exports = { sseClients, wsClients, addClient, removeClient, hasAnyConnection };
