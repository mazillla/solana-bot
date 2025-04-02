import { sharedLogger } from '../utils/sharedLogger.js';

await sharedLogger({
  service: 'test',
  level: 'info',
  message: '🚀 SharedLogger test message',
});

console.log('✅ Log sent to Redis Stream');
