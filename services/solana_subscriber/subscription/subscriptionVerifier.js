// services/solana_subscriber/subscription/subscriptionVerifier.js

/**
 * 🧪 Модуль верификации WebSocket-подписок.
 *
 * Проверяет, что все подписки из `activeSubscriptions` реально существуют
 * во внутреннем объекте `_rpcWebSocket._subscriptions` в web3.js.
 *
 * Если какая-то подписка «отвалилась» (например, не дошёл event 'close'),
 * то:
 * - логирует предупреждение
 * - пробует заново отписаться и подписаться
 *
 * 🔁 Верификация запускается с интервалом (по умолчанию — 60 секунд),
 * задаётся в subscriber_config.subscription_verifier_interval_ms.
 */

import { getCurrentConfig } from '../config/configLoader.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import {
  activeSubscriptions,
  unsubscribeFromAccount,
  subscribeToAccount,
} from './subscriptionManager.js';

let verifierInterval = null;

/**
 * 🚀 Запуск периодической верификации подписок
 */
export function startSubscriptionVerifier() {
  const interval = getCurrentConfig().subscription_verifier_interval_ms || 60000;

  verifierInterval = setInterval(async () => {
    for (const [key, sub] of activeSubscriptions.entries()) {
      const { subscriptionId, wsConn, chain_id, account, rpc_id } = sub;

      // 🧠 Проверка: подписка присутствует в ._subscriptions
      const isStillSubscribed =
        wsConn?._rpcWebSocket?._subscriptions?.has(subscriptionId);

      if (!isStillSubscribed) {
        // ⚠️ Подписка "отвалилась"
        await sharedLogger({
          service: getCurrentConfig().service_name,
          level: 'warn',
          message: {
            type: 'subscription_missing_in_ws',
            chain_id,
            account,
            subscriptionId,
            rpc_id,
          },
        });

        try {
          // ❌ Отписываемся от текущей (если она осталась в системе)
          await unsubscribeFromAccount(key);

          // ♻️ Повторно подписываемся
          await subscribeToAccount({
            chain_id,
            account,
            last_signature: sub.last_signature,
            priority: sub.priority,
          });

          // ✅ Успешное восстановление
          await sharedLogger({
            service: getCurrentConfig().service_name,
            level: 'info',
            message: {
              type: 'subscription_recovered_after_ws_missing',
              chain_id,
              account,
              rpc_id,
            },
          });
        } catch (err) {
          await sharedLogger({
            service: getCurrentConfig().service_name,
            level: 'error',
            message: {
              type: 'subscription_recovery_failed',
              chain_id,
              account,
              rpc_id,
              error: err.message,
            },
          });
        }
      }
    }
  }, interval);
}

/**
 * 🛑 Остановка верификации
 */
export function stopSubscriptionVerifier() {
  if (verifierInterval) {
    clearInterval(verifierInterval);
    verifierInterval = null;
  }
}
