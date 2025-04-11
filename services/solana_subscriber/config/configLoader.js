import { getSubscriberConfigFromDb } from '../db/subscriberConfig.js'; // Убедитесь, что импорт правильный
import { sharedLogger } from '../../../utils/sharedLogger.js';

let currentConfig = null;
const SERVICE_NAME = 'solana_subscriber';

export async function loadSubscriberConfig() {
  currentConfig = await getSubscriberConfigFromDb(); // Эта функция должна быть замокана в тестах

  await sharedLogger({
    service: SERVICE_NAME,
    level: 'info',
    message: '🔄 Конфигурация загружена из БД',
  });

  return currentConfig;
}

export function getCurrentConfig() {
  if (!currentConfig) {
    throw new Error('Конфигурация ещё не загружена. Используй loadSubscriberConfig() сначала.');
  }
  return currentConfig;
}

export async function updateAndReloadConfig() {
  currentConfig = await getSubscriberConfigFromDb(); // Замена должна быть здесь

  await sharedLogger({
    service: SERVICE_NAME,
    level: 'info',
    message: '♻️ Конфигурация обновлена из БД по команде update_config',
  });

  return currentConfig;
}
