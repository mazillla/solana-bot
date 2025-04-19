// utils/sharedLogger.js

// ✅ ГОТОВ (обновлён с валидацией)

// 📦 Redis-клиент (node-redis v4)
import { createClient } from 'redis';

// 🧠 Централизованная конфигурация (POSTGRES_URL, REDIS_URL и др.)
import { CONFIG } from './config/index.js';

// 🔍 Валидация payload перед логированием
import { isValidPayload } from './isValidPayload.js'; // 👈 новая утилита

// 🔒 Приватные переменные
let redis = null;                 // Redis клиент
let isConnected = false;         // Флаг подключения
const STREAM_KEY = 'logs:stream'; // Имя Redis Stream, куда пишутся логи

/**
 * 📢 Централизованный логгер для всех микросервисов
 *
 * Отправляет сообщения в Redis Stream `logs:stream`.
 * Гарантирует, что:
 * - Redis создаётся один раз
 * - Лог корректно сериализуется
 * - В случае ошибок использует fallback
 *
 * @param {object} options
 * @param {string} options.service - имя микросервиса
 * @param {string} [options.level="info"] - уровень лога (info, warn, error)
 * @param {object|string} options.message - тело лога (объект или строка)
 */
export async function sharedLogger({ service, level = 'info', message }) {
  try {
    // ❌ Предотвращаем публикацию пустых / невалидных сообщений
    if (
      typeof message !== 'string' &&
      !isValidPayload(message)
    ) {
      await fallbackLogger({
        service,
        level: 'warn',
        message: {
          type: 'shared_logger_invalid_message',
          input: message,
        },
      });
      return;
    }

    // 🔌 Создаём Redis-клиент при первом вызове
    if (!redis) {
      redis = createClient({ url: CONFIG.redis.url });
    }

    // 📡 Подключение (однократное)
    if (!isConnected) {
      await redis.connect();
      isConnected = true;
    }

    // 🧾 Формируем лог-запись
    const logEntry = {
      timestamp: new Date().toISOString(),
      service,
      level,
      message,
    };

    // 💡 Пробуем сериализовать
    let jsonData;
    try {
      jsonData = JSON.stringify(logEntry);
    } catch (serializationError) {
      await fallbackLogger({
        service,
        level: 'error',
        message: {
          type: 'shared_logger_serialization_failed',
          error: serializationError.message,
        },
      });
      return;
    }

    // 🚀 Отправляем в Redis Stream
    await redis.xAdd(STREAM_KEY, '*', { data: jsonData });

  } catch (err) {
    // 🛑 Redis недоступен → fallback
    await fallbackLogger({
      service,
      level: 'warn',
      message: {
        type: 'shared_logger_redis_failed',
        error: err.message,
      },
    });
  }
}

/**
 * 🛠 Резервный логгер (используется только при сбоях Redis или JSON.stringify)
 *
 * Выводит лог в stdout в читаемом виде. Используется только в крайних случаях.
 */
async function fallbackLogger({ service, level, message }) {
  const safeOutput = {
    timestamp: new Date().toISOString(),
    service,
    level,
    message,
  };

  console.log(`[fallbackLogger]`, JSON.stringify(safeOutput, null, 2));
}
