// services/solana_subscriber/queue/signatureUpdateBuffer.js

// ✅ ГОТОВ

/**
 * Модуль буферизации задач по обновлению `last_signature` в базе данных.
 *
 * Используется, когда во время публикации транзакции не удалось выполнить `updateLastSignature(...)` —
 * например, из-за временного сбоя PostgreSQL.
 *
 * Задачи не теряются — они помещаются в буфер, и затем повторно обрабатываются из фонового воркера.
 */

import { updateLastSignature } from '../db/subscriptions.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { getCurrentConfig } from '../config/configLoader.js';

// 📦 Буфер задач: key = `${chain_id}:${account}` → signature
const bufferMap = new Map();

// 🚩 Флаг активности воркера
let isRunning = false;

// 🔔 Сигнальный механизм "ожидания новой задачи"
let notifyResolve = null;

/**
 * Добавляет задачу на обновление подписи в буфер.
 * Если воркер ещё не запущен — запускает его.
 * Если воркер ждёт новую задачу — сигнализирует о поступлении.
 */
export function setPendingUpdate(chain_id, account, signature) {
  const key = `${chain_id}:${account}`;
  bufferMap.set(key, signature);

  // Если воркер находится в режиме ожидания — будим его
  if (notifyResolve) {
    notifyResolve();
    notifyResolve = null;
  }

  // Запускаем воркер, если он ещё не был активен
  if (!isRunning) {
    startSignatureUpdateWorker();
  }
}

/**
 * Запускает фонового воркера, если он ещё не запущен.
 * Воркеры работают бесконечно, пока alive.
 */
export function startSignatureUpdateWorker() {
  if (isRunning) return;
  isRunning = true;
  loop();
}

/**
 * Основной цикл фонового воркера.
 *
 * Логика:
 * - если буфер пуст — воркер "спит", пока не появится новая задача (await Promise)
 * - если в буфере есть задачи — перебираем их и пробуем обновить `last_signature`
 * - при успехе — удаляем из буфера
 * - при ошибке — оставляем на повторную попытку
 */
async function loop() {
  while (isRunning) {
    const entries = Array.from(bufferMap.entries());

    // 💤 Если буфер пуст — ждём прихода новых задач
    if (entries.length === 0) {
      await new Promise(resolve => (notifyResolve = resolve));
      continue;
    }

    // 🔄 Обрабатываем каждую задачу в буфере
    for (const [key, signature] of entries) {
      const [chain_id, account] = key.split(':');

      try {
        // ⬆️ Пытаемся обновить last_signature в базе
        await updateLastSignature(chain_id, account, signature);

        // ✅ Успешно — удаляем задачу из буфера
        bufferMap.delete(key);

        try {
          await sharedLogger({
            service: getCurrentConfig().service_name,
            level: 'info',
            message: {
              type: 'signature_updated',
              chain_id,
              account,
              signature,
            },
          });
        } catch (_) {}

      } catch (err) {
        // ⚠️ Ошибка — оставляем задачу в буфере и логируем предупреждение
        try {
          await sharedLogger({
            service: getCurrentConfig().service_name,
            level: 'warn',
            message: {
              type: 'signature_sync_failed',
              chain_id,
              account,
              signature,
              error: err.message,
            },
          });
        } catch (_) {}
      }
    }

    // 🔁 Переходим к следующему циклу: если буфер будет пуст — снова ждём задачу
  }
}
