const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function channelForInstance(instanceId) {
  return `notifications:instance:${instanceId}`;
}

// dung cho publish + cac lenh thuong (SADD/SREM/SMEMBERS cho presence)
function createRedisClient() {
  return new Redis(REDIS_URL);
}

// connection rieng chi de subscribe: ioredis khoa mot connection da SUBSCRIBE,
// khong the dung no de chay lenh thuong khac nua
function createSubscriber(channel, onMessage) {
  const sub = new Redis(REDIS_URL);

  sub.subscribe(channel, (err) => {
    if (err) {
      console.error('[redis] subscribe failed:', err.message);
    } else {
      console.log(`[redis] subscribed to "${channel}"`);
    }
  });

  sub.on('message', (ch, message) => {
    if (ch !== channel) return;
    try {
      onMessage(JSON.parse(message));
    } catch (err) {
      console.error('[redis] failed to parse message:', err.message);
    }
  });

  return sub;
}

module.exports = { createRedisClient, createSubscriber, channelForInstance };
