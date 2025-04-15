// utils/redisClientSingleton.js
import { createClient } from 'redis';

let redisClient = null;
let connected = false;

export async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://redis:6379',
    });

    try {
      await redisClient.connect();
      connected = true;
    } catch (err) {
      connected = false;
      throw new Error('❌ Не удалось подключиться к Redis: ' + err.message);
    }
  }

  return redisClient;
}

export async function disconnectRedisClient() {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (_) {}
    redisClient = null;
    connected = false;
  }
}
