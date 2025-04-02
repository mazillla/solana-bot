import { createClient } from 'redis';

const redis = createClient({ url: 'redis://redis:6379' });

await redis.connect();

const STREAM_KEY = 'logs:stream';

export async function sharedLogger({ service, level = 'info', message }) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    service,
    level,
    message,
  };

  await redis.xAdd(STREAM_KEY, '*', { data: JSON.stringify(logEntry) });
}
