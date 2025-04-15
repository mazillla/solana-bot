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
    await __runSinglePollIteration();
    await new Promise(r => setTimeout(r, 2000));
  }
}

export async function __runSinglePollIteration() {
  const length = getQueueLength();

  if (length > 0) {
    try {
      await sharedLogger({
        service: SERVICE_NAME,
        level: 'info',
        message: {
          event: 'queue_resumed',
          queue_length: length,
        },
      });
    } catch (_) {}
  }

  while (getQueueLength() > 0 && running) {
    await __processOneQueueItem();
  }
}

export async function __processOneQueueItem({
  chain_id = 'unknown',
  account = 'unknown',
  subscription_type = 'regular',
} = {}) {
  const signature = dequeueSignature();
  const rpc = await getAvailableRpc();
  if (!rpc) {
    enqueueSignature(signature);
    return;
  }

  const parsed = await getParsedTransactionWithTimeout(rpc, signature);
  if (!parsed) {
    await scheduleRetry(signature);
    return;
  }

  if (parsed.meta?.err) {
    try {
      await sharedLogger({
        service: SERVICE_NAME,
        level: 'warn',
        message: {
          type: 'failed_transaction',
          signature,
          error: parsed.meta.err,
        },
      });
    } catch (_) {}
    return;
  }

  const blockTime = parsed.blockTime || null;
  const timestamp = blockTime ? blockTime * 1000 : Date.now();

  const message = {
    chain_id,
    account,
    signature,
    log: parsed,
    subscription_type,
    blockTime,
    timestamp,
  };

  const streamKey =
    subscription_type === 'share'
      ? 'solana_logs_share'
      : subscription_type === 'mint'
      ? 'solana_logs_mint'
      : subscription_type === 'spl_token'
      ? 'solana_logs_spl'
      : subscription_type === 'control'
      ? 'solana_logs_control'
      : 'solana_logs_regular';

  try {
    await redisPublishLog(streamKey, message);

    try {
      await updateLastSignature(chain_id, account, signature);
    } catch (err) {
      try {
        await sharedLogger({
          service: SERVICE_NAME,
          level: 'error',
          message: {
            type: 'update_signature_failed',
            signature,
            error: err.message,
          },
        });
      } catch (_) {}
    }

    try {
      await sharedLogger({
        service: SERVICE_NAME,
        level: 'info',
        message: {
          type: 'transaction_dispatched_from_queue',
          signature,
          rpc_id: rpc.id,
        },
      });
    } catch (_) {}
  } catch (err) {
    try {
      await sharedLogger({
        service: SERVICE_NAME,
        level: 'error',
        message: {
          type: 'redis_publish_failed',
          signature,
          error: err.message,
        },
      });
    } catch (_) {}
    await scheduleRetry(signature);
  }
}

export { pollQueueLoop };
export function __setRunning(value) {
  running = value;
}
export { __runSinglePollIteration }; // 👈