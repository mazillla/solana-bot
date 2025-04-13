import { createClient } from 'redis';

let redis;
let isConnected = false;

export async function redisPublishLog(streamKey, messageObject) {
  try {
    if (!redis) {
      redis = createClient({ url: 'redis://redis:6379' });
    }

    if (!isConnected) {
      await redis.connect();
      isConnected = true;
    }

    const payload = JSON.stringify(messageObject);
    await redis.xAdd(streamKey, '*', { data: payload });
  } catch (err) {
    console.warn('[redisPublishLog] Redis error:', err.message);
  }
}
