import { redisPublishLog } from '../utils/redisLogSender.js';
import { updateLastSignature } from '../db/subscriptions.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';

const SERVICE_NAME = 'solana_subscriber';
const retryQueue = [];

let running = false;

export function startRedisRetryWorker() {
  running = true;
  workerLoop();
}

export function stopRedisRetryWorker() {
  running = false;
}

export function enqueueRedisRetry({ streamKey, message }) {
  retryQueue.push({ streamKey, message, retries: 0 });
}

async function workerLoop() {
  while (running) {
    if (retryQueue.length === 0) {
      await sleep(2000);
      continue;
    }

    const item = retryQueue.shift();
    const { streamKey, message, retries } = item;

    try {
      await redisPublishLog(streamKey, message);
      await updateLastSignature(message.chain_id, message.account, message.signature);

      await sharedLogger({
        service: SERVICE_NAME,
        level: 'info',
        message: {
          type: 'redis_retry_success',
          signature: message.signature,
        },
      });
    } catch (err) {
      if (retries < 5) {
        retryQueue.push({ ...item, retries: retries + 1 });
      } else {
        await sharedLogger({
          service: SERVICE_NAME,
          level: 'error',
          message: {
            type: 'redis_retry_failed',
            signature: message.signature,
            error: err.message,
          },
        });
      }
    }

    await sleep(1000);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
