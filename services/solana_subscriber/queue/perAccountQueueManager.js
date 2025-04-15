import { getParsedTransactionWithTimeout } from '../rpc/rpcUtils.js';
import { enqueueTransaction } from './publishQueue.js';
import { getCurrentConfig } from '../config/configLoader.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { sleep } from '../../../utils/sleep.js';

const SERVICE_NAME = 'solana_subscriber_perAccountQueue';

const prioritizedAccounts = new Set(); // key = `${chain_id}:${account}`
const accountQueues = new Map();       // key = `${chain_id}:${account}` → [{...}]
const isRunningMap = new Map();        // key = `${chain_id}:${account}` → boolean

export function markAccountAsPrioritized(chain_id, account) {
  const key = `${chain_id}:${account}`;
  prioritizedAccounts.add(key);

  if (!accountQueues.has(key)) {
    accountQueues.set(key, []);
    isRunningMap.set(key, false);
    startPerAccountWorker(chain_id, account);
  }
}

export function isPrioritized(chain_id, account) {
  return prioritizedAccounts.has(`${chain_id}:${account}`);
}

export function enqueueToPerAccountQueue(task) {
  const key = `${task.chain_id}:${task.account}`;
  const queue = accountQueues.get(key);
  if (!queue) return;

  if (!task.enqueuedAt) {
    task.enqueuedAt = Date.now();
  }

  queue.push(task);
}

function startPerAccountWorker(chain_id, account) {
  const key = `${chain_id}:${account}`;
  if (isRunningMap.get(key)) return;
  isRunningMap.set(key, true);

  const queue = accountQueues.get(key);
  const maxAge = getCurrentConfig().max_parse_duration_ms || 86400000;

  (async function loop() {
    while (true) {
      const task = queue.shift();

      if (!task) {
        await sleep(200);
        continue;
      }

      const now = Date.now();
      if (now - task.enqueuedAt > maxAge) {
        try {
          await sharedLogger({
            service: SERVICE_NAME,
            level: 'warn',
            message: {
              type: 'unresolved_transaction_priority',
              signature: task.signature,
              chain_id: task.chain_id,
              account: task.account,
              reason: 'max_age_exceeded',
            },
          });
        } catch (_) {}
        continue;
      }

      try {
        const rpc = await import('../rpc/rpcPool.js').then(mod => mod.getAvailableRpc());
        if (!rpc) {
          queue.push(task);
          continue;
        }

        if (!rpc.httpLimiter.removeToken()) {
          queue.push(task);
          await sleep(100);
          continue;
        }

        const parsed = await getParsedTransactionWithTimeout(rpc, task.signature);
        if (!parsed) {
          queue.push(task);
          continue;
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
        queue.push(task);
        try {
          await sharedLogger({
            service: SERVICE_NAME,
            level: 'error',
            message: {
              type: 'priority_worker_failed',
              signature: task.signature,
              chain_id: task.chain_id,
              account: task.account,
              error: err.message,
            },
          });
        } catch (_) {}
      }
    }
  })();
}


