// services/solana_subscriber/queue/publishQueue.js
import { redisPublishLog } from '../utils/redisLogSender.js';
import { updateLastSignature } from '../db/subscriptions.js';
import { setPendingUpdate } from './signatureUpdateBuffer.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { sleep } from '../../../utils/sleep.js';

const SERVICE_NAME = 'solana_subscriber_publishQueue';

const queue = [];
let isRunning = false;

export function enqueueTransaction(message) {
  queue.push(message);
}

export function startPublishQueueWorker() {
  if (isRunning) return;
  isRunning = true;
  workerLoop();
}

async function workerLoop() {
  while (isRunning) {
    const task = queue.shift();

    if (!task) {
      await sleep(200);
      continue;
    }

    try {
      await redisPublishLog('solana_logs', task);

      try {
        await updateLastSignature(task.chain_id, task.account, task.signature);
      } catch (err) {
        setPendingUpdate(task.chain_id, task.account, task.signature);
        try {
          await sharedLogger({
            service: SERVICE_NAME,
            level: 'warn',
            message: {
              type: 'update_signature_failed',
              signature: task.signature,
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
            type: 'transaction_published',
            signature: task.signature,
            chain_id: task.chain_id,
          },
        });
      } catch (_) {}

    } catch (err) {
      // Redis publish failed — повторим позже
      queue.push(task);

      try {
        await sharedLogger({
          service: SERVICE_NAME,
          level: 'error',
          message: {
            type: 'redis_publish_failed',
            signature: task.signature,
            error: err.message,
          },
        });
      } catch (_) {}
    }
  }
}


