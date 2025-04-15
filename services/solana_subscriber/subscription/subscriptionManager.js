// services/solana_subscriber/subscription/subscriptionManager.js
import { getAvailableRpc } from '../rpc/rpcPoolCore.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { handleLogEvent } from './onLogsHandler.js';
import { recoverTransactions } from './recoveryManager.js';
import { getLastSignatureForAccount } from '../db/subscriptions.js';
import { isPrioritized } from '../queue/perAccountQueueManager.js';
import { sendSubscriptionStateUpdate } from '../utils/subscriptionStatePublisher.js'; // 💡 создадим этот файл

const SERVICE_NAME = 'solana_subscriber';
const activeSubscriptions = new Map(); // key: `${chain_id}:${account}`

globalThis.__mockedSubscribeToAccount = null;

export async function startAllSubscriptions(subscriptionList) {
  for (const sub of subscriptionList) {
    await subscribeToAccount(sub);
  }
}

export async function stopAllSubscriptions() {
  for (const key of activeSubscriptions.keys()) {
    await unsubscribeFromAccount(key);
  }
}

export async function subscribeToAccount({ chain_id, account, last_signature = null, history_max_age_ms = null }) {
  const key = `${chain_id}:${account}`;
  if (activeSubscriptions.has(key)) return;

  const rpc = await getAvailableRpc();
  if (!rpc) {
    await sharedLogger({
      service: SERVICE_NAME,
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

  if (!last_signature) {
    last_signature = await getLastSignatureForAccount(chain_id, account);
  }

  // ✅ восстановление
  await recoverTransactions({
    chain_id,
    account,
    last_signature,
    history_max_age_ms,
  });

  // ▶️ подписка
  const id = rpc.wsConn.onLogs(account, async (logInfo) => {
    if (!logInfo?.signature || logInfo.err) return;
    await handleLogEvent({ chain_id, account, signature: logInfo.signature });
  });

  activeSubscriptions.set(key, {
    chain_id,
    account,
    rpc_id: rpc.id,
    subscriptionId: id,
    wsConn: rpc.wsConn,
  });

  await sharedLogger({
    service: SERVICE_NAME,
    level: 'info',
    message: {
      type: 'subscribe',
      chain_id,
      account,
      rpc_id: rpc.id,
    },
  });

  // ✅ статус connected: true
  try {
    await sendSubscriptionStateUpdate({
      chain_id,
      account,
      active: true,
      connected: true,
    });
  } catch (_) {}
}

export async function unsubscribeFromAccount(key) {
  const sub = activeSubscriptions.get(key);
  if (!sub) return;

  try {
    await sub.wsConn.removeOnLogsListener(sub.subscriptionId);
  } catch (err) {
    await sharedLogger({
      service: SERVICE_NAME,
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
  await sharedLogger({
    service: SERVICE_NAME,
    level: 'info',
    message: {
      type: 'unsubscribe',
      chain_id,
      account,
      rpc_id: sub.rpc_id,
    },
  });

  // ✅ статус connected: false
  try {
    await sendSubscriptionStateUpdate({
      chain_id,
      account,
      active: false,
      connected: false,
    });
  } catch (_) {}
}

export async function resubscribeAll() {
  const oldSubs = Array.from(activeSubscriptions.values());
  await stopAllSubscriptions();

  await publishAllDisconnected(); // 👈 перед восстановлением

  for (const sub of oldSubs) {
    await (globalThis.__mockedSubscribeToAccount || subscribeToAccount)({
      chain_id: sub.chain_id,
      account: sub.account,
    });

    await sharedLogger({
      service: SERVICE_NAME,
      level: 'info',
      message: {
        type: 'resubscribe',
        chain_id: sub.chain_id,
        account: sub.account,
      },
    });
  }
}

// 🔔 Вызывается при handleDisconnect
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

// экспорт для тестов
export const __activeSubscriptions = activeSubscriptions;
