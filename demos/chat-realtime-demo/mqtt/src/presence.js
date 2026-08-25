// Presence CLUSTER-WIDE, tu xay bang cach lang nghe event online/offline ma
// MOI instance (ke ca chinh no) phat len bus dung chung voi message/typing.
// Khac voi bien the socketio-redis-pubsub (co adapter lo san qua fetchSockets()),
// o day khong co gi "mien phi" ca - phai tu gom thu cong tren tung instance.
const presence = new Map(); // userId -> Set<instanceId dang giu ket noi cua user do>

function applyPresence({ userId, instanceId, online }) {
  if (!presence.has(userId)) presence.set(userId, new Set());
  const set = presence.get(userId);
  if (online) set.add(instanceId);
  else set.delete(instanceId);
  return set.size > 0;
}

function isOnline(userId) {
  return (presence.get(userId)?.size || 0) > 0;
}

module.exports = { applyPresence, isOnline };
