// ✅ ОБНОВЛЁННЫЙ

// 📦 Redis-клиент (singleton)
import { getRedisClient } from '../../../utils/redisClientSingleton.js';

// 🧠 Централизованный логгер
import { sharedLogger } from '../../../utils/sharedLogger.js';

// 📥 Загруженная конфигурация (в том числе stream_subscription_state)
import { getCurrentConfig } from '../config/configLoader.js';

/**
 * 📡 Отправляет событие `SUBSCRIPTION_STATE_CHANGED` в Redis Stream.
 *
 * Используется для оповещения других микросервисов и UI:
 * - когда подписка добавлена
 * - когда подписка удалена
 * - при пересоздании подписок (resubscribeAll)
 *
 * Поток указывается в `subscriber_config.stream_subscription_state`.
 *
 * @param {object} params
 * @param {string} params.chain_id - логическая цепочка (например, 'chain1')
 * @param {string} params.account - адрес Solana-аккаунта
 * @param {boolean} params.active - является ли подписка активной в БД
 * @param {boolean} params.connected - подключено ли WebSocket-соединение
 */
export async function sendSubscriptionStateUpdate({ chain_id, account, active, connected }) {
  const service = getCurrentConfig().service_name;
  const STREAM_KEY = getCurrentConfig().stream_subscription_state;

  // 📦 Формируем сообщение
  const message = {
    type: 'SUBSCRIPTION_STATE_CHANGED',
    chain_id,
    account,
    active,
    connected,
    timestamp: Date.now(),
  };

  // ✅ Минимальная валидация
  if (typeof message !== 'object' || message === null) {
    await sharedLogger({
      service,
      level: 'warn',
      message: {
        type: 'subscription_state_publish_skipped',
        reason: 'invalid_message_object',
        message,
      },
    });
    return;
  }

  try {
    const redis = await getRedisClient();

    // 🚀 Публикуем сообщение в Redis Stream
    await redis.xAdd(STREAM_KEY, '*', {
      data: JSON.stringify(message),
    });

  } catch (err) {
    // ❌ Redis недоступен или другая ошибка — логируем
    try {
      await sharedLogger({
        service,
        level: 'error',
        message: {
          type: 'publish_subscription_state_failed',
          error: err.message,
          account,
          chain_id,
        },
      });
    } catch (_) {}
  }
}
