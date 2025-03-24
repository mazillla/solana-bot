import Redis from 'ioredis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.resolve(__dirname, '../config/config.json');

let redisOptions;

try {
  const configRaw = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(configRaw);

  if (!config.redis || !config.redis.host || !config.redis.port) {
    throw new Error('Секция "redis" или обязательные поля отсутствуют в config.json');
  }

  redisOptions = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password || undefined,
  };
} catch (error) {
  console.error('[redis] ❌ Ошибка конфигурации Redis:', error.message || error);
  process.exit(1);
}

const redisClient = new Redis(redisOptions);

redisClient.on('connect', () => {
  console.log(`[redis] ✅ Подключено к Redis (${redisOptions.host}:${redisOptions.port})`);
});

redisClient.on('error', (err) => {
  console.error('[redis] ❌ Ошибка подключения к Redis:', err);
});

export { redisClient };
