// services/solana_subscriber/db/db.js

// ✅ ГОТОВ

import pg from 'pg';
import promiseRetry from 'promise-retry';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { getCurrentConfig } from '../config/configLoader.js';
import { CONFIG } from '../../../utils/config/index.js'; // централизованный доступ к переменным

// 🎯 Создаём общий пул соединений PostgreSQL
export const pool = new pg.Pool({
  connectionString: CONFIG.db.connectionString,
});

// 🧠 Флаг инициализации (предотвращает повторное подключение)
let isInitialized = false;

/**
 * ⚙️ Инициализация подключения к PostgreSQL.
 * 
 * Поведение:
 * - Подключается через пул
 * - Делает до 5 попыток (с задержками)
 * - Логирует успешное подключение
 * - Завершает процесс при фатальной ошибке
 */
export async function initPostgres() {
  // ⛔ Уже инициализировано — выходим
  if (isInitialized) return;

  try {
    // 🔁 Повторяем подключение с ретраями (до 5 раз)
    await promiseRetry(async (retry, attempt) => {
      try {
        const client = await pool.connect(); // 🔌 проверка соединения
        client.release(); // 🔓 освобождаем

        // ✅ Логируем успешное подключение
        await sharedLogger({
          service: getCurrentConfig().service_name,
          level: 'info',
          message: {
            type: 'postgres_connected',
            message: `Подключено к PostgreSQL (попытка #${attempt})`,
          },
        });

        isInitialized = true; // 🧠 помечаем как инициализированное

      } catch (err) {
        // 🟡 Логируем неудачную попытку (warning, но не критично)
        try {
          await sharedLogger({
            service: getCurrentConfig().service_name,
            level: 'warn',
            message: {
              type: 'postgres_connection_attempt_failed',
              attempt,
              error: err.message,
            },
          });
        } catch (_) {}

        retry(err); // 🔁 повторяем попытку
      }
    }, {
      retries: 5,
      minTimeout: 1000,
      maxTimeout: 5000,
    });

  } catch (err) {
    // ❌ Все попытки неудачны — логируем и завершаем
    try {
      await sharedLogger({
        service: getCurrentConfig().service_name,
        level: 'error',
        message: {
          type: 'postgres_connection_failed',
          error: err.message,
        },
      });
    } catch (_) {}

    process.exit(1); // ⛔ Завершаем процесс
  }
}

/**
 * 🛑 Закрытие пула соединений PostgreSQL.
 * 
 * Поведение:
 * - Закрывает пул только если он был инициализирован
 * - Логирует отключение
 * - Безопасен при повторных вызовах
 */
export async function closePostgres() {
  // 🔕 Если не подключались — ничего не делаем
  if (!isInitialized) return;

  try {
    await pool.end(); // 🧹 Закрываем соединения

    await sharedLogger({
      service: getCurrentConfig().service_name,
      level: 'info',
      message: {
        type: 'postgres_disconnected',
        message: 'Отключено от PostgreSQL',
      },
    });
  } catch (err) {
    // ⚠️ Логируем ошибку при закрытии (через sharedLogger)
    try {
      await sharedLogger({
        service: getCurrentConfig().service_name,
        level: 'warn',
        message: {
          type: 'postgres_disconnect_failed',
          error: err.message,
        },
      });
    } catch (_) {}
  }
}
