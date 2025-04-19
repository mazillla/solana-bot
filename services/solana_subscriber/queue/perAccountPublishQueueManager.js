// services/solana_subscriber/queue/perAccountPublishQueueManager.js

// ✅ ГОТОВ

/**
 * 🧩 Модуль для обработки приоритетных аккаунтов.
 * Для каждого приоритетного аккаунта создаётся отдельная очередь и воркер.
 * Это позволяет:
 * - обходить лимиты
 * - изолировать обработку от общей очереди
 * - давать "VIP" аккаунтам ускоренную обработку
 */

import { getParsedTransactionWithTimeout } from '../rpc/rpcUtils.js';
import { enqueueTransaction } from './publishQueue.js';
import { getCurrentConfig } from '../config/configLoader.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { sleep } from '../../../utils/sleep.js';

// 📌 Аккаунты с приоритетной обработкой
const prioritizedAccounts = new Set(); // key = `${chain_id}:${account}`

// 📦 Очереди задач по каждому приоритетному аккаунту
const accountQueues = new Map();       // key → [{...}]

// 🌀 Состояния воркеров (запущен или нет)
const isRunningMap = new Map();        // key → boolean

// 🔔 Промисы ожидания новой задачи по аккаунту
const queueResolvers = new Map();      // key → resolver (будильник)
const queueWaiters = new Map();        // key → Promise (ожидание новой задачи)

/**
 * ✅ Отметить аккаунт как приоритетный.
 * Создаёт очередь и воркер, если они ещё не существуют.
 */
export function markAccountAsPrioritized(chain_id, account) {
  const key = `${chain_id}:${account}`;
  prioritizedAccounts.add(key);

  if (!accountQueues.has(key)) {
    accountQueues.set(key, []);
    isRunningMap.set(key, false);

    // инициализируем механизм ожидания
    queueWaiters.set(key, new Promise(res => queueResolvers.set(key, res)));

    startPerAccountWorker(chain_id, account);
  }
}

/**
 * 🔍 Проверяет, является ли аккаунт приоритетным
 */
export function isPrioritized(chain_id, account) {
  return prioritizedAccounts.has(`${chain_id}:${account}`);
}

/**
 * 📥 Добавить задачу в очередь приоритетного аккаунта
 */
export function enqueueToPerAccountPublishQueue(task) {
  const key = `${task.chain_id}:${task.account}`;
  const queue = accountQueues.get(key);
  if (!queue) return;

  if (!task.enqueuedAt) {
    task.enqueuedAt = Date.now();
  }

  queue.push(task);

  // 🛎️ Будим воркер, если он ждёт
  const resolver = queueResolvers.get(key);
  if (resolver) {
    resolver();
    queueResolvers.set(key, null);
    queueWaiters.set(key, new Promise(res => queueResolvers.set(key, res)));
  }
}

/**
 * 🚀 Запуск воркера для одного аккаунта
 */
function startPerAccountWorker(chain_id, account) {
  const key = `${chain_id}:${account}`;
  if (isRunningMap.get(key)) return;
  isRunningMap.set(key, true);

  const queue = accountQueues.get(key);
  const maxAge = getCurrentConfig().max_parse_duration_ms || 86400000;

  (async function loop() {
    while (true) {
      const task = queue.shift();

      // 💤 Если очередь пуста — ждём новую задачу
      if (!task) {
        await queueWaiters.get(key);
        continue;
      }

      const now = Date.now();
      if (now - task.enqueuedAt > maxAge) {
        try {
          await sharedLogger({
            service: getCurrentConfig().service_name,
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
            service: getCurrentConfig().service_name,
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
