// services/solana_subscriber/db/subscriberConfig.js

// ✅ ГОТОВ

// 📦 Импорт пула PostgreSQL из модуля db.js
import { pool } from './db.js';

// 📢 Логгер, общий для всех сервисов (отправляет в Redis stream)
import { sharedLogger } from '../../../utils/sharedLogger.js';

// 🧠 Получение имени сервиса для логов
import { getCurrentConfig } from '../config/configLoader.js';

/**
 * 📡 Загружает актуальную конфигурацию подписчика из базы данных.
 * 
 * Использует таблицу `subscriber_config`, в которой хранится
 * JSON-конфигурация микросервиса `solana_subscriber`.
 * 
 * Возвращает объект последней записи, отсортированной по `updated_at DESC`.
 */
export async function getSubscriberConfigFromDb() {
  // 📜 SQL-запрос: выбираем последнюю (по времени) конфигурацию
  const query = `
    SELECT 
      rpc_endpoints,
      control_accounts,
      silence_threshold_ms,
      queue_max_length,
      rpc_timeout_ms,
      parse_concurrency,
      parse_queue_max_length,
      max_parse_duration_ms,
      heartbeat_interval_ms,
      default_history_max_age_ms,
      recovery_cooldown_ms,
      http_limit_per_sec,
      ws_limit_per_sec,
      service_name,
      stream_subscription_state,
      heartbeat_stream_key
    FROM subscriber_config
    ORDER BY updated_at DESC
    LIMIT 1;
  `;

  // 📥 Выполняем SQL-запрос
  const { rows } = await pool.query(query);

  // ⚠️ Если нет результатов — считаем это фатальной ошибкой
  if (!rows.length) {
    throw new Error('Нет доступной конфигурации в таблице subscriber_config');
  }

  // ✅ Опциональное логирование успешной загрузки
  try {
    await sharedLogger({
      service: getCurrentConfig().service_name,
      level: 'info',
      message: {
        type: 'subscriber_config_loaded',
        preview: {
          updated_keys: Object.keys(rows[0]), // 🔍 логируем только ключи (без значений)
        },
      },
    });
  } catch (_) {}

  // 📦 Возвращаем объект с параметрами (одна запись)
  return rows[0];
}
