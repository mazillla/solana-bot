// tests/producer.js
import { createClient } from 'redis';

const redis = createClient();
await redis.connect();

await redis.xAdd('logs:stream', '*', {
  data: JSON.stringify({
    service: 'test',
    level: 'info',
    timestamp: new Date().toISOString(),
    message: 'Привет из Redis!',
  }),
});

console.log('Лог отправлен');
await redis.quit();
