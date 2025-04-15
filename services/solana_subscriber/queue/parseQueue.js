import { getParsedTransactionWithTimeout } from '../rpc/rpcUtils.js';
import { getCurrentConfig } from '../config/configLoader.js';
import { enqueueTransaction } from './publishQueue.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { sleep } from '../../../utils/sleep.js';

const SERVICE_NAME = 'solana_subscriber_parseQueue';

const queue = [];
let runningTasks = 0;
let isRunning = false;

export function enqueueSignature(task) {
  const { parse_queue_max_length = 1000 } = getCurrentConfig();

  if (queue.length >= parse_queue_max_length) {
    try {
      sharedLogger({
        service: SERVICE_NAME,
        level: 'warn',
        message: {
          type: 'queue_overflow',
          signature: task.signature,
          chain_id: task.chain_id,
          account: task.account,
        },
      });
    } catch (_) {}
    return;
  }

  if (!task.enqueuedAt) {
    task.enqueuedAt = Date.now();
  }

  queue.push(task);
}

export function getQueueLength() {
  return queue.length;
}

export function startParseQueueWorker() {
  if (isRunning) return;
  isRunning = true;

  const config = getCurrentConfig();
  const concurrency = config.parse_concurrency || 3;

  for (let i = 0; i < concurrency; i++) {
    runWorkerLoop();
  }
}

async function runWorkerLoop() {
  while (isRunning) {
    const task = queue.shift();
    if (!task) {
      await sleep(200);
      continue;
    }

    runningTasks++;
    try {
      await handleSignatureTask(task);
    } catch (err) {
      try {
        await sharedLogger({
          service: SERVICE_NAME,
          level: 'error',
          message: {
            type: 'parse_queue_crash',
            error: err.message,
          },
        });
      } catch (_) {}
    }
    runningTasks--;
  }
}

async function handleSignatureTask(task) {
  const config = getCurrentConfig();
  const maxAge = config.max_parse_duration_ms || 86400000;
  const now = Date.now();

  if (now - task.enqueuedAt > maxAge) {
    try {
      await sharedLogger({
        service: SERVICE_NAME,
        level: 'warn',
        message: {
          type: 'unresolved_transaction',
          signature: task.signature,
          reason: 'max_age_exceeded',
        },
      });
    } catch (_) {}
    return;
  }

  let parsed = null;

  try {
    const rpc = await import('../rpc/rpcPool.js').then(mod => mod.getAvailableRpc());
    if (!rpc) {
      enqueueSignature(task);
      return;
    }

    if (!rpc.httpLimiter.removeToken()) {
      enqueueSignature(task);
      await sleep(100);
      return;
    }

    parsed = await getParsedTransactionWithTimeout(rpc, task.signature);
    if (!parsed) {
      enqueueSignature(task);
      return;
    }

    const blockTime = parsed.blockTime || null;
    const timestamp = blockTime ? blockTime * 1000 : Date.now();

    const message = {
      chain_id: task.chain_id,
      account: task.account,
      signature: task.signature,
      log: parsed,
      blockTime,
      timestamp,
    };

    enqueueTransaction(message);
  } catch (err) {
    enqueueSignature(task);
  }
}
