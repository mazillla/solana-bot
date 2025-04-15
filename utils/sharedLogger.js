import { safeStringify } from './safeStringify.js';

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

    let jsonData;
    try {
      jsonData = safeStringify(logEntry); // 💡 теперь это можно мокать!
    } catch (serializationError) {
      console.warn('[sharedLogger] JSON serialization error:', serializationError.message);
      return;
    }

    await redis.xAdd(STREAM_KEY, '*', { data: jsonData });
  } catch (err) {
    console.warn('[sharedLogger] Redis suppressed error:', err.message);
  }
}
