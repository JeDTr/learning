// Khac han 2 bien the redis-streams/kafka (broadcast toi MOI instance roi tu
// loc cuc bo), o day dung dung diem manh cua MQTT: LOC NGAY TAI BROKER bang
// topic. Message/typing cua 1 user duoc publish vao topic RIENG cua user do
// (chat/user/<id>/msg), va CHI instance nao dang thuc su giu ket noi cuc bo
// cua user do moi SUBSCRIBE topic ay (subscribe/unsubscribe DONG theo vong
// doi connect/disconnect). Instance khong lien quan khong nhan duoc goi tin
// nao ca - khong phai do code tu bo qua, ma vi broker khong bao gio gui toi.
//
// Presence dung RETAINED message: publish voi retain=true nghia la broker giu
// lai gia tri MOI NHAT cua topic do; bat ky client nao subscribe SAU nay (vi
// du 1 instance moi khoi dong) lap tuc nhan duoc trang thai hien tai ngay khi
// subscribe, khong can doi event moi phat sinh - khong co khai niem tuong
// duong "gon" nhu vay o pub/sub thuan (bien the socketio-redis-pubsub).
//
// QoS: message dung QoS 1 (broker dam bao giao it nhat 1 lan, co the trung
// nhung khong mat trong pham vi phien ket noi con song); typing/presence dung
// QoS 0 (fire-and-forget, chap nhan mat vi la du lieu "gia tri moi nhat thang
// gia tri cu", mat 1 event typing khong quan trong).
const mqtt = require('mqtt');

const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883';

const topicMsg = (userId) => `chat/user/${userId}/msg`;
const topicTyping = (userId) => `chat/user/${userId}/typing`;
const topicPresence = (userId) => `chat/presence/${userId}`;

async function connectBus(instanceId, handlers) {
  const client = mqtt.connect(MQTT_URL, {
    clientId: `chat-${instanceId}-${Math.random().toString(36).slice(2, 8)}`,
  });

  await new Promise((resolve, reject) => {
    client.once('connect', resolve);
    client.once('error', reject);
  });
  console.log(`[mqtt] instance ${instanceId} da ket noi broker`);

  // Presence can duoc nhin thay boi MOI instance (bat ke instance do co client
  // cuc bo nao hay khong, vi dropdown "chat voi" co the tro toi bat ky ai) ->
  // day la subscribe TINH, khong theo vong doi connect nhu topic msg/typing.
  client.subscribe('chat/presence/+', { qos: 0 });

  client.on('message', (topic, buf) => {
    try {
      const payload = JSON.parse(buf.toString());
      if (topic.startsWith('chat/presence/')) handlers.onPresence(payload);
      else if (topic.endsWith('/typing')) handlers.onTyping(payload);
      else if (topic.endsWith('/msg')) handlers.onMessage(payload);
    } catch (err) {
      console.error('[mqtt] xu ly message loi:', err.message);
    }
  });

  // refcount: 1 user co the mo nhieu tab tren CUNG 1 instance, chi unsubscribe
  // that su khi khong con tab nao cua user do o instance nay nua.
  const localRefCount = new Map();

  function subscribeUser(userId) {
    const count = (localRefCount.get(userId) || 0) + 1;
    localRefCount.set(userId, count);
    if (count === 1) {
      client.subscribe([topicMsg(userId), topicTyping(userId)], { qos: 1 });
      console.log(`[mqtt] subscribe topic rieng cua "${userId}" (chi instance nay moi nhan tu day tro di)`);
    }
  }

  function unsubscribeUser(userId) {
    const count = (localRefCount.get(userId) || 0) - 1;
    if (count <= 0) {
      localRefCount.delete(userId);
      client.unsubscribe([topicMsg(userId), topicTyping(userId)]);
      console.log(`[mqtt] unsubscribe topic cua "${userId}" (khong con client cuc bo nao tren instance nay)`);
    } else {
      localRefCount.set(userId, count);
    }
  }

  return {
    subscribeUser,
    unsubscribeUser,
    publishMessage: (msg) => client.publish(topicMsg(msg.recipientId), JSON.stringify(msg), { qos: 1 }),
    publishTyping: (t) => client.publish(topicTyping(t.to), JSON.stringify(t), { qos: 0 }),
    publishPresence: (p) =>
      client.publish(topicPresence(p.userId), JSON.stringify(p), { qos: 0, retain: true }),
    close: () =>
      new Promise((resolve) => {
        client.end(false, {}, resolve);
      }),
  };
}

module.exports = { connectBus };
