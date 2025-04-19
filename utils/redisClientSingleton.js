// utils/redisClientSingleton.js

// ✅ ГОТОВ (обновлён)

// 📦 Redis-клиент (node-redis v4)
import { createClient } from 'redis';

// 🧠 Централизованная конфигурация (POSTGRES_URL, REDIS_URL и т.д.)
import { CONFIG } from './config/index.js';

// 📢 Общий логгер
import { sharedLogger } from './sharedLogger.js';

// 🔁 Один глобальный клиент на весь процесс
let redisClient = null;
let connected = false;

/**
 * 📡 Возвращает singleton Redis-клиент.
 * 
 * Поведение:
 * - если уже подключён → возвращает его;
 * - если не создан → создаёт, подключает, логирует;
 * - при ошибке подключения → выбрасывает исключение.
 */
export async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({ url: CONFIG.redis.url });

    // Подписка на ошибки Redis
    redisClient.on('error', async (err) => {
      try {
        await sharedLogger({
          service: 'redisClient',
          level: 'error',
          message: {
            type: 'redis_error',
            error: err.message,
          },
        });
      } catch (_) {}
    });

    // Подписка на переподключение
    redisClient.on('reconnecting', async () => {
      try {
        await sharedLogger({
          service: 'redisClient',
          level: 'warn',
          message: {
            type: 'redis_reconnecting',
          },
        });
      } catch (_) {}
    });

    try {
      await redisClient.connect(); // 🔌 Подключаемся
      connected = true;

      // ✅ Лог об успешном подключении
      await sharedLogger({
        service: 'redisClient',
        level: 'info',
        message: {
          type: 'redis_connected',
          url: CONFIG.redis.url,
        },
      });

    } catch (err) {
      connected = false;
      throw new Error('❌ Не удалось подключиться к Redis: ' + err.message);
    }
  }

  return redisClient;
}

/**
 * 🛑 Отключает Redis (если он был создан).
 * Безопасен при повторном вызове.
 */
export async function disconnectRedisClient() {
  if (redisClient) {
    try {
      await redisClient.quit(); // 🧹 Закрытие соединения

      await sharedLogger({
        service: 'redisClient',
        level: 'info',
        message: {
          type: 'redis_disconnected',
        },
      });

    } catch (err) {
      try {
        await sharedLogger({
          service: 'redisClient',
          level: 'warn',
          message: {
            type: 'redis_disconnect_failed',
            error: err.message,
          },
        });
      } catch (_) {}
    }

    redisClient = null;
    connected = false;
  }
}
