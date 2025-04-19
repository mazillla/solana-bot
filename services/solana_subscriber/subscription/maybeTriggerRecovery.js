// services/solana_subscriber/subscription/maybeTriggerRecovery.js

// ✅ ОБНОВЛЁН: добавлена TTL для rateLimitedRpcIds

/**
 * Этот модуль отвечает за запуск восстановления транзакций (recoverTransactions)
 * для всех аккаунтов, подписанных через конкретный WebSocket RPC, в случае превышения лимита (rate limit).
 *
 * Почему это важно:
 * При rate limit-е Solana WebSocket может "потерять" сигнатуры для подписанных аккаунтов.
 * Чтобы не упустить эти транзакции, мы запускаем восстановление по всем аккаунтам, использующим тот же RPC.
 */

import { recoverTransactions } from './recoveryManager.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { getCurrentConfig } from '../config/configLoader.js';

/**
 * @typedef {Object} Subscription
 * @property {string} chain_id - Название цепочки, к которой принадлежит подписка.
 * @property {string} account - Адрес Solana-аккаунта, на который подписались.
 * @property {string} rpc_id - ID RPC-клиента, через который была установлена подписка.
 */

/**
 * Хранилище RPC ID, на которых уже был зафиксирован rate limit, с TTL (время жизни).
 * Мы используем Map, чтобы в будущем можно было анализировать метку времени или добавить счётчики.
 */
const rateLimitedRpcIds = new Map();

/**
 * Функция для обработки ситуации, когда на RPC был превышен лимит WebSocket-запросов.
 *
 * @param {string} rpc_id - ID RPC клиента, где сработал лимит
 * @param {Map<string, Subscription>} activeSubscriptions - Список всех активных подписок
 */
export function maybeTriggerRecovery(rpc_id, activeSubscriptions) {
  const config = getCurrentConfig();

  const cooldownMs = config.recovery_cooldown_ms || 60000; // 🔁 TTL (по умолчанию 1 минута)
  const recoveryAgeMs = config.recovery_max_age_ms || 300000; // 🕒 восстановление за последние 5 минут

  // 🧠 Уже триггерили на этот RPC — выходим
  if (rateLimitedRpcIds.has(rpc_id)) return;

  // ✅ Добавляем в Map с временной меткой
  rateLimitedRpcIds.set(rpc_id, Date.now());

  // ⏲️ Планируем удаление из Map через cooldown
  setTimeout(() => {
    rateLimitedRpcIds.delete(rpc_id);
  }, cooldownMs);

  // 🔁 Перебираем все активные подписки, ищем те, что связаны с этим RPC
  for (const sub of activeSubscriptions.values()) {
    if (sub.rpc_id !== rpc_id) continue;

    const { chain_id, account } = sub;

    try {
      sharedLogger({
        service: config.service_name,
        level: 'info',
        message: {
          type: 'recovery_triggered_due_to_rate_limit',
          chain_id,
          account,
          rpc_id,
        },
      });
    } catch (_) {}

    recoverTransactions({
      chain_id,
      account,
      last_signature: null,
      history_max_age_ms: recoveryAgeMs,
    }).catch(async (err) => {
      try {
        await sharedLogger({
          service: config.service_name,
          level: 'error',
          message: {
            type: 'recovery_failed_after_rate_limit',
            chain_id,
            account,
            rpc_id,
            error: err.message,
          },
        });
      } catch (_) {}
    });
  }
}
