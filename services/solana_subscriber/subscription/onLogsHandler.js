import { enqueueSignature } from '../queue/parseQueue.js';
import { enqueueToPerAccountQueue, isPrioritized } from '../queue/perAccountQueueManager.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { maybeTriggerRecovery } from './maybeTriggerRecovery.js'; // создадим этот файл

const SERVICE_NAME = 'solana_subscriber';

export async function handleLogEvent({ chain_id, account, signature, rpc }) {
  try {
    if (!signature) return;

    // 🪣 Проверяем лимит WebSocket
    if (!rpc.wsLimiter.removeToken()) {
      try {
        await sharedLogger({
          service: SERVICE_NAME,
          level: 'warn',
          message: {
            type: 'ws_rate_limited',
            signature,
            chain_id,
            account,
            rpc_id: rpc.id,
          },
        });
      } catch (_) {}

      maybeTriggerRecovery(chain_id, account); // ✅ запускаем восстановление, если нужно
      return;
    }

    const task = {
      chain_id,
      account,
      signature,
      enqueuedAt: Date.now(),
    };

    if (isPrioritized(chain_id, account)) {
      enqueueToPerAccountQueue(task);
    } else {
      enqueueSignature(task);
    }

    try {
      await sharedLogger({
        service: SERVICE_NAME,
        level: 'info',
        message: {
          type: 'signature_received',
          signature,
          chain_id,
          account,
        },
      });
    } catch (_) {}
  } catch (err) {
    try {
      await sharedLogger({
        service: SERVICE_NAME,
        level: 'error',
        message: {
          type: 'handle_log_event_failed',
          signature,
          chain_id,
          account,
          error: err.message,
        },
      });
    } catch (_) {}
  }
}
