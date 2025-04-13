import { getAvailableRpc } from '../rpc/rpcPoolCore.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { handleLogEvent } from './onLogsHandler.js';
import { recoverTransactions } from './recoveryManager.js';
import { getLastSignatureForAccount } from '../db/subscriptions.js'; // добавим
import { getCurrentConfig } from '../config/configLoader.js';

const SERVICE_NAME = 'solana_subscriber';

const activeSubscriptions = new Map(); // key: `${chain_id}:${account}`

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

export async function subscribeToAccount({ chain_id, account, subscription_type, last_signature = null }) {
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
        subscription_type,
      },
    });
    return;
  }

  // 🔁 если нет last_signature от команды — берём из БД
  if (!last_signature) {
    last_signature = await getLastSignatureForAccount(chain_id, account);
  }

  // ✅ запуск восстановления
  if (last_signature || subscription_type === 'regular') {
    await recoverTransactions({
      chain_id,
      account,
      last_signature,
      subscription_type,
    });
  }

  // ▶️ подписка onLogs
  const id = rpc.wsConn.onLogs(account, async (logInfo) => {
    if (!logInfo?.signature || logInfo.err) return;

    await handleLogEvent({
      chain_id,
      account,
      signature: logInfo.signature,
      subscription_type,
      rpc,
    });
  });

  activeSubscriptions.set(key, {
    chain_id,
    account,
    rpc_id: rpc.id,
    subscription_type,
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
      subscription_type,
      rpc_id: rpc.id,
    },
  });
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
      subscription_type: sub.subscription_type,
      rpc_id: sub.rpc_id,
    },
  });
}

export async function resubscribeAll() {
  const oldSubs = Array.from(activeSubscriptions.values());
  await stopAllSubscriptions();
  for (const sub of oldSubs) {
    await subscribeToAccount({
      chain_id: sub.chain_id,
      account: sub.account,
      subscription_type: sub.subscription_type,
    });

    await sharedLogger({
      service: SERVICE_NAME,
      level: 'info',
      message: {
        type: 'resubscribe',
        chain_id: sub.chain_id,
        account: sub.account,
        subscription_type: sub.subscription_type,
      },
    });
  }
}

// ⬇️ ДОБАВЬ ЭТО В САМОМ НИЗУ subscriptionManager.js
export const __activeSubscriptions = activeSubscriptions;
