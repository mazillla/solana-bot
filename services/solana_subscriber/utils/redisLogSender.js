import { createClient } from 'redis';

const redis = createClient({ url: 'redis://redis:6379' });
await redis.connect();

export async function redisPublishLog(streamKey, messageObject) {
  const payload = JSON.stringify(messageObject);
  await redis.xAdd(streamKey, '*', { data: payload });
}
