// services/solana_subscriber/subscription/onLogsHandler.js

// ✅ ГОТОВ (обновлён с проверкой сигнатуры)

/**
 * Этот модуль обрабатывает события логов (onLogs), приходящие по WebSocket
 * от подписанных аккаунтов Solana.
 *
 * Каждое событие может содержать сигнатуру транзакции. Цель модуля — определить:
 * - нужно ли реагировать на событие
 * - в какую очередь поместить сигнатуру
 * - что делать при превышении лимита WebSocket RPC (rate limit)
 *
 * Дальнейшая обработка транзакции (парсинг, публикация и т.д.) происходит в других модулях.
 */

import { enqueueSignature } from '../queue/parseQueue.js';
import { enqueueToPerAccountPublishQueue, isPrioritized } from '../queue/perAccountPublishQueueManager.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { maybeTriggerRecovery } from './maybeTriggerRecovery.js';
import { getCurrentConfig } from '../config/configLoader.js';

/**
 * Обработка одного события логов (WebSocket).
 *
 * @param {Object} params - Входные параметры
 * @param {string} params.chain_id - Название цепочки, к которой относится аккаунт
 * @param {string} params.account - Адрес аккаунта, по которому пришли логи
 * @param {string} params.signature - Сигнатура транзакции (txid)
 * @param {Object} params.rpc - Объект RPC-клиента, через который пришло событие
 *
 * Поведение:
 * - если сигнатура отсутствует — игнорируем
 * - если лимит WebSocket превышен — логируем, запускаем восстановление через maybeTriggerRecovery
 * - создаём задачу и помещаем в нужную очередь:
 *    - приоритетную (если isPrioritized)
 *    - обычную очередь для парсинга
 * - любые ошибки логируются, чтобы не упал WebSocket обработчик
 */
export async function handleLogEvent({ chain_id, account, signature, rpc }) {
  try {
    /**
     * ✅ Проверяем валидность сигнатуры:
     * - должна быть строкой
     * - должна быть длиной минимум 80 символов (эвристика)
     */
    if (typeof signature !== 'string' || signature.length < 80) return;

    // Формируем задачу для последующей обработки
    const task = {
      chain_id,
      account,
      signature,
      enqueuedAt: Date.now(),
    };

    /**
     * Проверяем лимит WebSocket-запросов (rate limit).
     * Если лимит превышен — не теряем событие, а инициируем восстановление всех подписок на этом RPC.
     */
    if (!rpc.wsLimiter.removeToken()) {
      try {
        await sharedLogger({
          service: getCurrentConfig().service_name,
          level: 'warn',
          message: {
            type: 'ws_rate_limited',
            signature,
            chain_id,
            account,
            rpc_id: rpc.id,
          },
        });
      } catch (_) {}

      maybeTriggerRecovery(rpc.id);
      return;
    }

    /**
     * В зависимости от приоритета аккаунта, помещаем задачу
     * в соответствующую очередь:
     * - perAccountQueue → индивидуальный воркер с высоким приоритетом
     * - parseQueue → общая очередь для стандартной обработки
     */
    if (isPrioritized(chain_id, account)) {
      enqueueToPerAccountPublishQueue(task);
    } else {
      enqueueSignature(task);
    }

  } catch (err) {
    /**
     * Логируем ошибку, чтобы не прервать поток обработки событий
     */
    try {
      await sharedLogger({
        service: getCurrentConfig().service_name,
        level: 'error',
        message: {
          type: 'handle_log_event_failed',
          signature,
          chain_id,
          account,
          error: err.message,
        },
      });
    } catch (_) {}
  }
}
