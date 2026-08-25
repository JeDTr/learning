// "Bus" dung 1 Kafka topic (chat-events, 3 partition) cho ca 3 loai event:
// message / typing / presence. Giong het tinh than voi bien the redis-streams:
// MOI instance dung mot groupId RIENG (vd "chat-consumer-kafka-a") thay vi
// dung chung 1 groupId cho ca cluster - vi Kafka consumer group von sinh ra de
// CHIA tai (competing consumers trong cung group khong bao gio nhan trung
// message). O day can nguoc lai: BROADCAST toi moi instance, nen moi instance
// phai la 1 group doc lap.
//
// Diem khac voi redis-streams dang chu y:
// - Message duoc key bang conversationId -> Kafka dam bao moi message trong
//   CUNG 1 conversation luon nam tren CUNG 1 partition -> thu tu (ordering)
//   duoc giu nguyen tuyet doi trong pham vi 1 conversation, ke ca khi co
//   nhieu producer (nhieu instance) cung ghi dong thoi. Redis Streams cung co
//   thu tu (vi chi 1 stream key), nhung khong co khai niem partition/scale
//   ngang o muc do nay.
// - Kafka topic mac dinh giu log lau hon nhieu (retention theo thoi gian/dung
//   luong, khong bi xoa ngay sau khi consume) -> phu hop de sau nay them 1
//   consumer group MOI (vd service phan tich, audit log) doc lai TU DAU ma
//   khong dung gi toi producer/consumer hien tai. Redis Streams lam duoc dieu
//   tuong tu nhung thuong voi retention nho hon, gioi han boi RAM.
// - Chi phi ha tang: Kafka (kem KRaft/ZooKeeper truoc day) nang hon han Redis
//   ve van hanh, doi lai throughput va kha nang scale ngang qua nhieu broker
//   cao hon nhieu - phu hop khi luu luong tin nhan/event that su lon.
const { Kafka } = require('kafkajs');

const BROKER = process.env.KAFKA_BROKER || 'localhost:9092';
const TOPIC = 'chat-events';

async function connectBus(instanceId, handlers) {
  const kafka = new Kafka({
    clientId: `chat-${instanceId}`,
    brokers: [BROKER],
    retry: { retries: 15, initialRetryTime: 1000, maxRetryTime: 10000 },
  });

  const admin = kafka.admin();
  await admin.connect();
  await admin.createTopics({
    topics: [{ topic: TOPIC, numPartitions: 3, replicationFactor: 1 }],
    waitForLeaders: true,
  });
  await admin.disconnect();

  const producer = kafka.producer();
  await producer.connect();

  const groupId = `chat-consumer-${instanceId}`;
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  // fromBeginning: false - stream lich su da co SQLite lo, topic o day chi
  // dong vai tro live-push. Nhung vi groupId gan voi instanceId, neu instance
  // restart no van resume dung offset da luu (khong doc lai tu dau, cung
  // khong bo lo event phat sinh trong luc down) - giong tinh chat cua streams.
  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const type = message.headers?.type?.toString();
        const payload = JSON.parse(message.value.toString());
        if (type === 'message') handlers.onMessage(payload);
        else if (type === 'typing') handlers.onTyping(payload);
        else if (type === 'presence') handlers.onPresence(payload);
      } catch (err) {
        console.error('[kafka] xu ly message loi:', err.message);
      }
    },
  });

  function publish(type, payload, key) {
    return producer.send({
      topic: TOPIC,
      messages: [{ key: key || null, value: JSON.stringify(payload), headers: { type } }],
    });
  }

  return {
    // key = conversationId -> dam bao thu tu trong tung conversation
    publishMessage: (msg) => publish('message', msg, msg.conversationId),
    publishTyping: (t) => publish('typing', t, t.to),
    publishPresence: (p) => publish('presence', p, p.userId),
    close: async () => {
      await consumer.disconnect();
      await producer.disconnect();
    },
  };
}

module.exports = { connectBus };
