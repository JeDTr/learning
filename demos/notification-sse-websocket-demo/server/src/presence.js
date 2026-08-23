// Presence registry: userId -> Set<instanceId> dang giu connection song (SSE hoac WS)
// cua user do. Dung Redis Set de nhieu instance co the cung dang giu ket noi
// cua cung 1 user (vi du user mo 2 tab, moi tab roi vao 1 instance khac nhau).
const PRESENCE_PREFIX = 'presence:';
const HEARTBEAT_PREFIX = 'instance:heartbeat:';

// TTL cua heartbeat > chu ky refresh kha nhieu (~3x) de chiu duoc vai lan
// refresh bi tre/mat goi ma khong bi coi la chet oan.
const HEARTBEAT_TTL_SECONDS = Number(process.env.PRESENCE_HEARTBEAT_TTL_SECONDS || 30);
const HEARTBEAT_INTERVAL_MS = Number(process.env.PRESENCE_HEARTBEAT_INTERVAL_MS || 10000);

function presenceKey(userId) {
  return `${PRESENCE_PREFIX}${userId}`;
}

function heartbeatKey(instanceId) {
  return `${HEARTBEAT_PREFIX}${instanceId}`;
}

async function registerPresence(redis, userId, instanceId) {
  await redis.sadd(presenceKey(userId), instanceId);
}

async function unregisterPresence(redis, userId, instanceId) {
  await redis.srem(presenceKey(userId), instanceId);
}

// Tra danh sach instance dang thuc su con song va giu ket noi cua user.
// Dong thoi tu don rac: neu 1 instanceId trong Set khong con heartbeat
// (instance da crash ma khong kip SREM sach truoc khi chet), loai no khoi
// ket qua tra ve VA xoa luon khoi Set - "lazy cleanup" ngay tai thoi diem
// lookup, khong can 1 job quet nen rieng chay dinh ky.
async function lookupInstances(redis, userId) {
  const key = presenceKey(userId);
  const instanceIds = await redis.smembers(key);
  if (instanceIds.length === 0) return [];

  const pipeline = redis.pipeline();
  instanceIds.forEach((instanceId) => pipeline.exists(heartbeatKey(instanceId)));
  const results = await pipeline.exec();

  const alive = [];
  const dead = [];
  instanceIds.forEach((instanceId, i) => {
    const [err, exists] = results[i];
    if (!err && exists) alive.push(instanceId);
    else dead.push(instanceId);
  });

  if (dead.length > 0) {
    await redis.srem(key, ...dead);
    console.log(`[presence] don rac ${dead.length} instance da chet khoi presence:${userId} -> [${dead.join(', ')}]`);
  }

  return alive;
}

// Moi instance dinh ky "tu bao con song" bang mot key co TTL, refresh truoc
// khi TTL het han. Neu instance crash (process chet dot ngot, khong kip
// clearInterval/SREM), key nay tu het han sau HEARTBEAT_TTL_SECONDS va
// lookupInstances() o tren se coi day la instance chet, tu dong don presence
// lien quan - khong can cho instance do tu don sach truoc khi chet.
function startHeartbeat(redis, instanceId) {
  const beat = () => {
    redis.set(heartbeatKey(instanceId), '1', 'EX', HEARTBEAT_TTL_SECONDS).catch((err) =>
      console.error('[presence] heartbeat failed:', err.message)
    );
  };
  beat();
  const interval = setInterval(beat, HEARTBEAT_INTERVAL_MS);
  return () => clearInterval(interval);
}

module.exports = { registerPresence, unregisterPresence, lookupInstances, startHeartbeat };
