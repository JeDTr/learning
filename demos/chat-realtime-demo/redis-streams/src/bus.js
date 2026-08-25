// "Bus" dung 1 Redis Stream duy nhat (chat:events) cho ca 3 loai event: message
// / typing / presence. Diem mau chot: MOI instance tao mot CONSUMER GROUP
// MANG TEN CHINH NO (vd "instance:streams-a"), khong dung chung 1 group cho ca
// cluster. Consumer group thong thuong dung de CHIA tai (competing consumers -
// moi message chi 1 consumer trong group nhan). O day muc tieu nguoc lai: can
// BROADCAST toi moi instance de tung instance tu quyet dinh co client cuc bo
// nao can nhan hay khong -> moi instance phai la 1 group rieng thi moi "thay"
// duoc toan bo entry.
//
// Vi group gan voi instanceId va Redis nho vi tri da doc/ack cua tung group,
// neu instance crash roi restart, no KHONG mat entry phat sinh trong luc down
// (dieu ma pub/sub thuan tuy - vd bien the socketio-redis-pubsub - khong lam
// duoc, vi pub/sub khong co bo nho, chi ai dang subscribe tai thoi diem publish
// moi nhan). Day la trade-off chinh dang so sanh giua 2 bien the dung Redis.
const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const STREAM_KEY = 'chat:events';

async function connectBus(instanceId, handlers) {
  const publisher = new Redis(REDIS_URL);
  const consumer = new Redis(REDIS_URL);

  const groupName = `instance:${instanceId}`;
  try {
    // '$' = chi doc entry phat sinh TU BAY GIO tro di (khong replay lich su cu,
    // vi lich su da co SQLite lo roi - stream o day chi dong vai tro live-push).
    await consumer.xgroup('CREATE', STREAM_KEY, groupName, '$', 'MKSTREAM');
    console.log(`[streams] tao consumer group moi "${groupName}" (bat dau tu thoi diem hien tai)`);
  } catch (err) {
    if (!String(err.message).includes('BUSYGROUP')) throw err;
    console.log(
      `[streams] consumer group "${groupName}" da ton tai -> resume tu vi tri da luu, khong mat event phat sinh trong luc instance down`
    );
  }

  let running = true;
  (async function loop() {
    while (running) {
      let response;
      try {
        response = await consumer.xreadgroup(
          'GROUP', groupName, 'consumer-1',
          'COUNT', 20, 'BLOCK', 5000,
          'STREAMS', STREAM_KEY, '>'
        );
      } catch (err) {
        if (running) console.error('[streams] xreadgroup loi:', err.message);
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      if (!response) continue; // het BLOCK ma khong co entry moi

      for (const [, entries] of response) {
        for (const [id, fields] of entries) {
          try {
            const obj = {};
            for (let i = 0; i < fields.length; i += 2) obj[fields[i]] = fields[i + 1];
            const payload = JSON.parse(obj.payload);
            if (obj.type === 'message') handlers.onMessage(payload);
            else if (obj.type === 'typing') handlers.onTyping(payload);
            else if (obj.type === 'presence') handlers.onPresence(payload);
          } catch (err) {
            console.error('[streams] xu ly event loi:', err.message);
          }
          // ACK ngay sau khi xu ly xong (du xu ly la "khong lien quan toi minh")
          // - group cua instance nay da chinh thuc "thay" entry nay roi.
          await consumer.xack(STREAM_KEY, groupName, id);
        }
      }
    }
  })();

  function publish(type, payload) {
    return publisher.xadd(STREAM_KEY, '*', 'type', type, 'payload', JSON.stringify(payload));
  }

  return {
    publishMessage: (msg) => publish('message', msg),
    publishTyping: (t) => publish('typing', t),
    publishPresence: (p) => publish('presence', p),
    close: async () => {
      running = false;
      await publisher.quit();
      await consumer.quit();
    },
  };
}

module.exports = { connectBus };
