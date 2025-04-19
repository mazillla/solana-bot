// services/solana_subscriber/queue/publishQueue.js

// ✅ ГОТОВ

/**
 * 📤 Очередь публикации готовых транзакций в Redis Stream.
 * Обеспечивает:
 * - публикацию события `transaction_published`
 * - сохранение last_signature в БД
 * - обработку ошибок и повторные попытки
 */

import { publishToStream } from '../../../utils/redisStreamBus.js';
import { updateLastSignature } from '../db/subscriptions.js';
import { setPendingUpdate } from './signatureUpdateBuffer.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { getCurrentConfig } from '../config/configLoader.js';

// 📦 Очередь готовых к публикации задач
const queue = [];

// 🔃 Состояние воркера
let isRunning = false;

// 🔔 Механизм ожидания новых задач
let resolver = null;
let waitForNewTask = new Promise((res) => {
  resolver = res;
});

/**
 * 📥 Ставит готовую транзакцию в очередь публикации
 */
export function enqueueTransaction(message) {
  queue.push(message);

  // 🛎️ Если воркер "спит", будим его
  if (resolver) {
    resolver();
    resolver = null;
    waitForNewTask = new Promise((res) => {
      resolver = res;
    });
  }
}

/**
 * 🚀 Запускает фоновый воркер для обработки очереди
 */
export function startPublishQueueWorker() {
  if (isRunning) return;
  isRunning = true;
  workerLoop();
}

/**
 * 🔁 Воркер:
 * - ждёт появления задач
 * - публикует транзакции
 * - сохраняет last_signature
 * - обрабатывает ошибки
 */
async function workerLoop() {
  while (isRunning) {
    const task = queue.shift();

    if (!task) {
      await waitForNewTask; // 💤 ждём поступления новой задачи
      continue;
    }

    try {
      // 1️⃣ Публикация события
      await publishToStream({
        service: getCurrentConfig().service_name,
        type: 'transaction_published',
        payload: task,
      });

      // 2️⃣ Сохраняем сигнатуру
      try {
        await updateLastSignature(task.chain_id, task.account, task.signature);
      } catch (err) {
        setPendingUpdate(task.chain_id, task.account, task.signature);
        await sharedLogger({
          service: getCurrentConfig().service_name,
          level: 'warn',
          message: {
            type: 'update_signature_failed',
            signature: task.signature,
            error: err.message,
          },
        });
      }

      // 3️⃣ Логируем успешную публикацию
      await sharedLogger({
        service: getCurrentConfig().service_name,
        level: 'info',
        message: {
          type: 'transaction_published',
          signature: task.signature,
          chain_id: task.chain_id,
        },
      });

    } catch (err) {
      // 4️⃣ Ошибка публикации → retry
      queue.push(task);
      await sharedLogger({
        service: getCurrentConfig().service_name,
        level: 'error',
        message: {
          type: 'stream_publish_failed',
          signature: task.signature,
          error: err.message,
        },
      });
    }
  }
}
