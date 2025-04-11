import { getAvailableRpc } from '../rpc/rpcPool.js';
import { getParsedTransactionWithTimeout } from '../rpc/rpcUtils.js';
import { enqueueSignature, dequeueSignature, getQueueLength } from './onLogsQueue.js';
import { scheduleRetry } from './retryQueue.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { redisPublishLog } from '../utils/redisLogSender.js';
import { updateLastSignature } from '../db/subscriptions.js';
import { getCurrentConfig } from '../config/configLoader.js';

const SERVICE_NAME = 'solana_subscriber';

let running = false;

export function startOnLogsQueueWorker() {
  running = true;
  pollQueueLoop();
}

export function stopOnLogsQueueWorker() {
  running = false;
}

async function pollQueueLoop() {
  while (running) {
    const length = getQueueLength();
    if (length > 0) {
      await sharedLogger({
        service: SERVICE_NAME,
        level: 'info',
        message: {
          event: 'queue_resumed',
          queue_length: length,
        },
      });
    }

    while (getQueueLength() > 0 && running) {
      const signature = dequeueSignature();
      const rpc = await getAvailableRpc();
      if (!rpc) {
        enqueueSignature(signature); // вернуть обратно
        break;
      }

      const parsed = await getParsedTransactionWithTimeout(rpc, signature);
      if (!parsed) {
        await scheduleRetry(signature);
        continue;
      }

      if (parsed.meta?.err) {
        await sharedLogger({
          service: SERVICE_NAME,
          level: 'warn',
          message: {
            type: 'failed_transaction',
            signature,
            error: parsed.meta.err,
          },
        });
        continue;
      }

      const blockTime = parsed.blockTime || null;
      const timestamp = blockTime ? blockTime * 1000 : Date.now();

      const message = {
        chain_id: 'unknown',
        account: 'unknown',
        signature,
        log: parsed,
        subscription_type: 'regular', // не знаем точно, можно пометить явно
        blockTime,
        timestamp,
      };

      try {
        await redisPublishLog('solana_logs_regular', message);
        await sharedLogger({
          service: SERVICE_NAME,
          level: 'info',
          message: {
            type: 'transaction_dispatched_from_queue',
            signature,
            rpc_id: rpc.id,
          },
        });
      } catch (err) {
        await sharedLogger({
          service: SERVICE_NAME,
          level: 'error',
          message: {
            type: 'redis_publish_failed',
            signature,
            error: err.message,
          },
        });
        await scheduleRetry(signature);
      }
    }

    await new Promise(r => setTimeout(r, 2000));
  }
}

export { pollQueueLoop };
