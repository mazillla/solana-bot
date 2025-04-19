// services/solana_subscriber/subscription/recoveryManager.js

// ✅ ГОТОВ

/**
 * Модуль восстановления транзакций (по сигнатурам) для Solana-аккаунтов.
 *
 * Используется при:
 * - старте подписки (`subscribeToAccount`)
 * - сбое RPC или reconnect-е (`resubscribeAll`)
 * - превышении лимита WebSocket (`maybeTriggerRecovery`)
 *
 * Восстановление происходит по следующим правилам:
 * - мы запрашиваем сигнатуры через RPC методом `getSignaturesForAddress`
 * - ограничиваем восстановление по времени (`maxAgeMs`) или по `last_signature`
 * - загружаем сигнатуры постранично (limit = 1000), пока не получим всё
 * - добавляем их в очередь на парсинг (`enqueueSignature` или `enqueueToPerAccountQueue`)
 *
 * Все сигнатуры сортируются в порядке **от старой к новой**, чтобы сохранить консистентность.
 */

import { getSignaturesForAddressWithTimeout } from '../rpc/rpcUtils.js';
import { getAvailableRpc } from '../rpc/rpcPool.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { enqueueSignature } from '../queue/parseQueue.js';
import { enqueueToPerAccountPublishQueue, isPrioritized } from '../queue/perAccountPublishQueueManager.js';
import { getCurrentConfig } from '../config/configLoader.js';


/**
 * Восстанавливает транзакции (сигнатуры) по указанному аккаунту.
 *
 * @param {Object} params
 * @param {string} params.chain_id - Название логической цепочки (chain1, chain2 и т.п.)
 * @param {string} params.account - Адрес Solana-аккаунта (на который была подписка)
 * @param {string|null} params.last_signature - Сигнатура, до которой (исключительно) нужно восстановить
 *
 * Поведение:
 * - если last_signature = null → восстановление до максимального возраста (`maxAgeMs`)
 * - если last_signature указана → восстановление идёт до неё, не включая её саму
 */
export async function recoverTransactions({ chain_id, account, last_signature }) {
  /**
   * Получаем доступный RPC-клиент для выполнения запроса.
   * Если нет доступного — логируем предупреждение и выходим.
   */
  const rpc = await getAvailableRpc();
  if (!rpc) {
    try {
      await sharedLogger({
        service: getCurrentConfig().service_name,
        level: 'warn',
        message: {
          type: 'recovery_skipped',
          reason: 'no_available_rpc',
          chain_id,
          account,
        },
      });
    } catch (_) {}
    return;
  }

  /**
   * Логируем начало восстановления
   */
  try {
    await sharedLogger({
      service: getCurrentConfig().service_name,
      level: 'info',
      message: {
        type: 'recovery_started',
        chain_id,
        account,
        rpc_id: rpc.id,
        from: last_signature || 'start',
      },
    });
  } catch (_) {}

  // Конфигурация и инициализация
  const allSignatures = [];
  const maxAgeMs = getCurrentConfig().default_history_max_age_ms || 86400000;
  const now = Date.now();

  let before = undefined;
  let keepFetching = true;

  /**
   * 🔁 Основной цикл постраничной загрузки сигнатур
   * Solana отдаёт сигнатуры от НОВЫХ к СТАРЫМ (обратный порядок),
   * поэтому мы просто `push`, а в конце — `reverse()`.
   */
  while (keepFetching) {
    const options = {
      limit: 1000,
      ...(before ? { before } : {}),
      ...(last_signature ? { until: last_signature } : {}),
    };

    const sigs = await getSignaturesForAddressWithTimeout(rpc, account, options);
    if (!sigs || sigs.length === 0) break;

    // Фильтруем только подтверждённые
    const confirmed = sigs.filter(sig => sig.confirmationStatus === 'confirmed');

    for (const sig of confirmed) {
      // Если достигли заданной last_signature → останавливаемся
      if (sig.signature === last_signature) {
        keepFetching = false;
        break;
      }

      // Если sig устарел по времени → тоже прекращаем
      if (sig.blockTime && sig.blockTime * 1000 < now - maxAgeMs) {
        keepFetching = false;
        break;
      }

      allSignatures.push(sig);
    }

    // Если вернулось меньше 1000 — это последняя страница
    if (sigs.length < 1000) break;

    // Переход к следующей странице (ещё более старые транзакции)
    before = sigs[sigs.length - 1].signature;
  }

  /**
   * Переворачиваем список — теперь от СТАРОЙ к НОВОЙ
   */
  allSignatures.reverse();

  /**
   * Помещаем каждую сигнатуру в соответствующую очередь на обработку
   */
  for (const sig of allSignatures) {
    const task = {
      chain_id,
      account,
      signature: sig.signature,
      enqueuedAt: Date.now(),
    };

    if (isPrioritized(chain_id, account)) {
      enqueueToPerAccountPublishQueue(task);
    } else {
      enqueueSignature(task);
    }
  }

  /**
   * Логируем завершение восстановления
   */
  try {
    await sharedLogger({
      service: getCurrentConfig().service_name,
      level: 'info',
      message: {
        type: 'recovery_queued',
        chain_id,
        account,
        count: allSignatures.length,
      },
    });
  } catch (_) {}
}
