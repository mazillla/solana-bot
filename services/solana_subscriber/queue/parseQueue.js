// services/solana_subscriber/queue/parseQueue.js

// ✅ ГОТОВ

/**
 * 🧠 Очередь парсинга транзакций по сигнатурам (txid), полученных через WebSocket или восстановление.
 *
 * 💡 Новая логика:
 * - вместо sleep(200) при пустой очереди — воркеры "засыпают"
 * - при поступлении новой задачи — "будим" воркеры через Promise
 */

import { getParsedTransactionWithTimeout } from '../rpc/rpcUtils.js';
import { getCurrentConfig } from '../config/configLoader.js';
import { enqueueTransaction } from './publishQueue.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { sleep } from '../../../utils/sleep.js';

// 📦 Очередь задач на парсинг
const queue = [];

// 🏃‍♂️ Статус запущенности воркеров
let isRunning = false;

// 🔢 Сколько задач сейчас выполняется
let runningTasks = 0;

// 🔔 Механизм ожидания новых задач (если очередь пуста)
let resolver = null;
let waitForNewTask = new Promise((res) => {
  resolver = res;
});

/**
 * 📥 Добавляет новую задачу в очередь парсинга и будит воркеров, если они "спят".
 *
 * @param {Object} task - объект { chain_id, account, signature, enqueuedAt? }
 */
export function enqueueSignature(task) {
  if (!task.enqueuedAt) {
    task.enqueuedAt = Date.now();
  }

  queue.push(task);

  // ⏰ Будим воркеров, если они ожидали новую задачу
  if (resolver) {
    resolver(); // пробуждаем
    resolver = null;
    waitForNewTask = new Promise((res) => {
      resolver = res; // создаём новое ожидание
    });
  }
}

/**
 * 🚀 Запускает N воркеров для обработки очереди.
 * Количество воркеров задаётся параметром parse_concurrency из config.
 */
export function startParseQueueWorker() {
  if (isRunning) return;
  isRunning = true;

  const concurrency = getCurrentConfig().parse_concurrency || 3;

  for (let i = 0; i < concurrency; i++) {
    runWorkerLoop(); // 🔁 запускаем каждый воркер
  }
}

/**
 * 🛑 Останавливает все воркеры (используется при обновлении конфига).
 */
export function stopParseQueueWorker() {
  isRunning = false;
}

/**
 * 🔁 Воркер:
 * - забирает задачу
 * - если нет задач — ждёт, пока придёт новая
 * - обрабатывает транзакцию
 */
async function runWorkerLoop() {
  while (isRunning) {
    const task = queue.shift();

    if (!task) {
      await waitForNewTask; // 💤 ждём, пока поступит новая задача
      continue;
    }

    runningTasks++;

    try {
      await handleSignatureTask(task);
    } catch (err) {
      try {
        await sharedLogger({
          service: getCurrentConfig().service_name,
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

/**
 * ⚙️ Обрабатывает одну сигнатуру:
 * - проверяет "свежесть"
 * - делает getParsedTransaction с таймаутом
 * - в случае успеха — передаёт в publishQueue
 * - в случае ошибки — возвращает обратно в очередь
 */
async function handleSignatureTask(task) {
  const config = getCurrentConfig();
  const maxAge = config.max_parse_duration_ms || 86400000;
  const now = Date.now();

  // ⏳ Пропускаем задачу, если она слишком старая
  if (now - task.enqueuedAt > maxAge) {
    try {
      await sharedLogger({
        service: config.service_name,
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

  try {
    const rpc = await import('../rpc/rpcPool.js').then(mod => mod.getAvailableRpc());
    if (!rpc) {
      enqueueSignature(task); // retry позже
      return;
    }

    if (!rpc.httpLimiter.removeToken()) {
      enqueueSignature(task); // лимит превышен — retry
      await sleep(100);
      return;
    }

    const parsed = await getParsedTransactionWithTimeout(rpc, task.signature);
    if (!parsed) {
      enqueueSignature(task); // пустой результат — retry
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

    enqueueTransaction(message); // ✅ передаём на публикацию

  } catch (err) {
    enqueueSignature(task); // ошибка → retry
  }
}
