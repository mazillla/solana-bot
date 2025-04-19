// services/solana_subscriber/config/configLoader.js

// ✅ ГОТОВ (с валидацией)

import { getSubscriberConfigFromDb } from '../db/subscriberConfig.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { validateConfig } from './validateConfig.js'; // 🆕 Импорт валидатора

let currentConfig = null;

/**
 * 📥 Загружает конфигурацию подписчика из таблицы subscriber_config.
 * Сохраняет результат в переменную `currentConfig`, доступную во всём микросервисе.
 * 
 * Используется:
 * - при старте сервиса
 * - при обновлении по Redis-команде config_update_command
 */
export async function loadSubscriberConfig() {
  const raw = await getSubscriberConfigFromDb();

  // 🧪 Проверка: валидный объект
  if (!raw || typeof raw !== 'object') {
    throw new Error('Загруженная конфигурация из БД пуста или некорректна');
  }

  // 🧪 Валидация полной конфигурации (через validateConfig.js)
  const { valid, errors } = validateConfig(raw);
  if (!valid) {
    await sharedLogger({
      service: raw.service_name || 'solana_subscriber',
      level: 'error',
      message: {
        type: 'config_validation_failed',
        errors,
      },
    });
    throw new Error('Конфигурация из БД не прошла валидацию');
  }

  // 🧠 Сохраняем замороженный (immutable) объект
  currentConfig = Object.freeze({
    parse_concurrency: raw.parse_concurrency || 3,
    max_parse_duration_ms: raw.max_parse_duration_ms || 86400000,
    heartbeat_interval_ms: raw.heartbeat_interval_ms || 30000,
    rpc_endpoints: raw.rpc_endpoints || [],
    control_accounts: raw.control_accounts || [],
    silence_threshold_ms: raw.silence_threshold_ms || 30000,
    queue_max_length: raw.queue_max_length || 1000,
    rpc_timeout_ms: raw.rpc_timeout_ms || 5000,
    default_history_max_age_ms: raw.default_history_max_age_ms || 604800000,
    recovery_cooldown_ms: raw.recovery_cooldown_ms || 60000,
    service_name: raw.service_name || 'solana_subscriber',
    stream_subscription_state: raw.stream_subscription_state || 'subscriber_subscription_state',
    heartbeat_stream_key: raw.heartbeat_stream_key || 'system_heartbeat',
    commitment: raw.commitment || 'confirmed',
    subscription_verifier_interval_ms: raw.subscription_verifier_interval_ms || 60000,
    recovery_max_age_ms: raw.recovery_max_age_ms || 300000,
    configVersion: raw.updated_at || new Date().toISOString(), // 💾 можно логировать версию
  });

  try {
    await sharedLogger({
      service: currentConfig.service_name,
      level: 'info',
      message: '🔄 Конфигурация успешно загружена из БД',
    });
  } catch (_) {}

  return currentConfig;
}

/**
 * 💡 Возвращает текущую загруженную конфигурацию.
 * Бросает ошибку, если конфигурация не была загружена.
 */
export function getCurrentConfig() {
  if (!currentConfig) {
    throw new Error('Конфигурация ещё не загружена. Используй loadSubscriberConfig() сначала.');
  }
  return currentConfig;
}

/**
 * 🧪 Проверка: загружена ли уже конфигурация
 * Можно использовать в health-чек или для диагностики
 */
export function isConfigLoaded() {
  return !!currentConfig;
}

/**
 * 🔄 Повторно загружает конфигурацию из БД.
 * Возвращает { old, updated } — для сравнения и принятия решений.
 */
export async function updateAndReloadConfig() {
  const old = currentConfig;
  const updated = await loadSubscriberConfig();

  try {
    await sharedLogger({
      service: updated.service_name,
      level: 'info',
      message: '♻️ Конфигурация обновлена из БД по команде update_config',
    });
  } catch (_) {}

  return { old, updated };
}
