// services/solana_subscriber/config/configLoader.js
import { getSubscriberConfigFromDb } from '../db/subscriberConfig.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';

let currentConfig = null;
const SERVICE_NAME = 'solana_subscriber';

export async function loadSubscriberConfig() {
  const raw = await getSubscriberConfigFromDb();

  currentConfig = {
    parse_concurrency: raw.parse_concurrency || 3,
    parse_queue_max_length: raw.parse_queue_max_length || 1000,
    max_parse_duration_ms: raw.max_parse_duration_ms || 86400000,
    heartbeat_interval_ms: raw.heartbeat_interval_ms || 30000,
    rpc_endpoints: raw.rpc_endpoints || [],
    control_accounts: raw.control_accounts || [],
    silence_threshold_ms: raw.silence_threshold_ms || 30000,
    queue_max_length: raw.queue_max_length || 1000,
    rpc_timeout_ms: raw.rpc_timeout_ms || 5000,
    default_history_max_age_ms: raw.default_history_max_age_ms || 604800000,
    recovery_cooldown_ms: raw.recovery_cooldown_ms || 60000,
  };

  try {
    await sharedLogger({
      service: SERVICE_NAME,
      level: 'info',
      message: '🔄 Конфигурация загружена из БД',
    });
  } catch (_) {}

  return currentConfig;
}

export function getCurrentConfig() {
  if (!currentConfig) {
    throw new Error('Конфигурация ещё не загружена. Используй loadSubscriberConfig() сначала.');
  }
  return currentConfig;
}

export async function updateAndReloadConfig() {
  const old = currentConfig;
  const updated = await loadSubscriberConfig();

  try {
    await sharedLogger({
      service: SERVICE_NAME,
      level: 'info',
      message: '♻️ Конфигурация обновлена из БД по команде update_config',
    });
  } catch (_) {}

  return { old, updated };
}
