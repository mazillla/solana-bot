// services/solana_subscriber/subscription/subscriptionManager.js

// ✅ ГОТОВ

/**
 * 📡 Модуль управления подписками на аккаунты Solana.
 *
 * Выполняет:
 * - запуск новых подписок
 * - остановку подписок
 * - восстановление истории
 * - буферизацию логов, полученных до завершения восстановления
 */

import { getAvailableRpc } from '../rpc/rpcPool.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { handleLogEvent } from './onLogsHandler.js';
import { recoverTransactions } from './recoveryManager.js';

import {
  getLastSignatureForAccount,
  upsertSubscription,
  deactivateSubscription,
} from '../db/subscriptions.js';

import {
  isPrioritized,
  markAccountAsPrioritized,
} from '../queue/perAccountPublishQueueManager.js';

import { sendSubscriptionStateUpdate } from '../utils/subscriptionStatePublisher.js';
import { getCurrentConfig } from '../config/configLoader.js';

// Активные подписки: key = `${chain_id}:${account}` → {...}
const activeSubscriptions = new Map();

// Флаги восстановления
const recoveryInProgress = new Map();

// Буфер логов, пришедших до восстановления
const bufferedSignatures = new Map();

/**
 * 🔁 Старт всех подписок из БД
 */
export async function startAllSubscriptions(subscriptionList) {
  for (const sub of subscriptionList) {
    await subscribeToAccount({
      chain_id: sub.chain_id,
      account: sub.account,
      last_signature: sub.last_signature,
      priority: sub.priority === true,
    });
  }
}

/**
 * ⛔ Завершение всех подписок
 */
export async function stopAllSubscriptions() {
  for (const key of activeSubscriptions.keys()) {
    await unsubscribeFromAccount(key);
  }
}

/**
 * 📥 Подписка на конкретный аккаунт
 */
export async function subscribeToAccount({
  chain_id,
  account,
  last_signature = null,
  history_max_age_ms,
  priority = false,
}) {
  const key = `${chain_id}:${account}`;

  if (activeSubscriptions.has(key)) return;

  // Если приоритет — сразу активируем воркер
  if (priority === true) {
    markAccountAsPrioritized(chain_id, account);
  }

  const configHistoryMaxAge = getCurrentConfig().default_history_max_age_ms;
  const effectiveHistoryAge = history_max_age_ms || configHistoryMaxAge;

  // ⏺️ Запись в БД
  try {
    await upsertSubscription({
      chain_id,
      account,
      last_signature,
      history_max_age_ms: effectiveHistoryAge,
      priority,
    });
  } catch (err) {
    await sharedLogger({
      service: getCurrentConfig().service_name,
      level: 'error',
      message: {
        type: 'upsert_subscription_failed',
        chain_id,
        account,
        error: err.message,
      },
    });
    return;
  }

  // 🌐 RPC WebSocket
  const rpc = await getAvailableRpc();
  if (!rpc) {
    await sharedLogger({
      service: getCurrentConfig().service_name,
      level: 'warn',
      message: {
        type: 'subscribe_skipped',
        reason: 'no_available_rpc',
        chain_id,
        account,
      },
    });
    return;
  }

  // 🧾 Последняя сигнатура
  if (!last_signature) {
    last_signature = await getLastSignatureForAccount(chain_id, account);
  }

  recoveryInProgress.set(key, true);
  bufferedSignatures.set(key, []);

  // 🔔 Подписка на логи
  const id = rpc.wsConn.onLogs(account, async (logInfo) => {
    if (!logInfo?.signature) return;
    const signature = logInfo.signature;

    if (recoveryInProgress.has(key)) {
      bufferedSignatures.get(key).push(signature);
    } else {
      await handleLogEvent({ chain_id, account, signature, rpc });
    }
  });

  // 💾 Регистрируем подписку
  activeSubscriptions.set(key, {
    chain_id,
    account,
    rpc_id: rpc.id,
    subscriptionId: id,
    wsConn: rpc.wsConn,
    last_signature,
    history_max_age_ms: effectiveHistoryAge,
  });

  // 📢 Лог
  await sharedLogger({
    service: getCurrentConfig().service_name,
    level: 'info',
    message: {
      type: 'subscribe',
      chain_id,
      account,
      rpc_id: rpc.id,
      priority,
    },
  });

  // 📡 Redis
  try {
    await sendSubscriptionStateUpdate({
      chain_id,
      account,
      active: true,
      connected: true,
    });
  } catch (_) {}

  // ⏮️ Восстановление
  try {
    await recoverTransactions({
      chain_id,
      account,
      last_signature,
      history_max_age_ms: effectiveHistoryAge,
    });
  } catch (err) {
    await sharedLogger({
      service: getCurrentConfig().service_name,
      level: 'error',
      message: {
        type: 'recovery_failed',
        chain_id,
        account,
        error: err.message,
      },
    });
  }

  // 📦 Обработка буфера
  const buffer = bufferedSignatures.get(key) || [];
  for (const signature of buffer) {
    await handleLogEvent({ chain_id, account, signature, rpc });
  }

  recoveryInProgress.delete(key);
  bufferedSignatures.delete(key);

  await sharedLogger({
    service: getCurrentConfig().service_name,
    level: 'info',
    message: {
      type: 'recovery_finished',
      chain_id,
      account,
      buffered_signatures: buffer.length,
    },
  });
}

/**
 * ❌ Отписка от аккаунта
 */
export async function unsubscribeFromAccount(key) {
  const sub = activeSubscriptions.get(key);
  if (!sub) return;

  try {
    await sub.wsConn.removeOnLogsListener(sub.subscriptionId);
  } catch (err) {
    await sharedLogger({
      service: getCurrentConfig().service_name,
      level: 'warn',
      message: {
        type: 'unsubscribe_failed',
        error: err.message,
        key,
      },
    });
  }

  activeSubscriptions.delete(key);

  const [chain_id, account] = key.split(':');
  await deactivateSubscription({ chain_id, account });

  await sharedLogger({
    service: getCurrentConfig().service_name,
    level: 'info',
    message: {
      type: 'unsubscribe',
      chain_id,
      account,
      rpc_id: sub.rpc_id,
    },
  });

  try {
    await sendSubscriptionStateUpdate({
      chain_id,
      account,
      active: false,
      connected: false,
    });
  } catch (_) {}
}

/**
 * ♻️ Повторная подписка на все аккаунты
 */
export async function resubscribeAll() {
  const oldSubs = Array.from(activeSubscriptions.entries());

  await stopAllSubscriptions();
  await publishAllDisconnected();

  for (const [key, sub] of oldSubs) {
    const { chain_id, account, last_signature } = sub;

    try {
      await subscribeToAccount({
        chain_id,
        account,
        last_signature,
        priority: sub.priority === true,
      });

      await sharedLogger({
        service: getCurrentConfig().service_name,
        level: 'info',
        message: {
          type: 'resubscribe',
          chain_id,
          account,
        },
      });
    } catch (err) {
      await sharedLogger({
        service: getCurrentConfig().service_name,
        level: 'error',
        message: {
          type: 'resubscribe_failed',
          chain_id,
          account,
          error: err.message,
        },
      });
    }
  }
}

/**
 * 🔄 Уведомление об отключении всех подписок
 */
export async function publishAllDisconnected() {
  for (const key of activeSubscriptions.keys()) {
    const [chain_id, account] = key.split(':');
    try {
      await sendSubscriptionStateUpdate({
        chain_id,
        account,
        active: true,
        connected: false,
      });
    } catch (_) {}
  }
}
