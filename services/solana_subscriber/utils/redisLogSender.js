import { getRedisClient } from '../../../utils/redisClientSingleton.js';

export async function redisPublishLog(streamKey, messageObject) {
  try {
    const redis = await getRedisClient();
    const payload = JSON.stringify(messageObject);
    await redis.xAdd(streamKey, '*', { data: payload });
  } catch (err) {
    console.warn('[redisPublishLog] Redis error:', err.message);
  }
}
