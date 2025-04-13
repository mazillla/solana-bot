import { createClient } from 'redis';

let redis;
let isConnected = false;
const STREAM_KEY = 'logs:stream';

export async function sharedLogger({ service, level = 'info', message }) {
  try {
    if (!redis) {
      redis = createClient({ url: 'redis://redis:6379' });
    }

    if (!isConnected) {
      await redis.connect();
      isConnected = true;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      service,
      level,
      message,
    };

    await redis.xAdd(STREAM_KEY, '*', { data: JSON.stringify(logEntry) });
  } catch (err) {
    // 👇 Просто молча игнорируем любые ошибки Redis
    console.warn('[sharedLogger] Redis suppressed error:', err.message);
  }
}
