// services/solana_subscriber/config/redisConsumer.js

// ✅ ГОТОВ

// 📦 Работа с Redis Stream: подписка, ack, восстановление отложенных сообщений
import {
  consumeFromStream,
  ackMessage,
  recoverAllPendingMessages,
} from '../../../utils/redisStreamBus.js';

// ⚙️ Управление подписками
import {
  subscribeToAccount,
  unsubscribeFromAccount,
  resubscribeAll,
} from '../subscription/subscriptionManager.js';

// 🔁 Перезагрузка конфигурации из БД
import { updateAndReloadConfig } from './configLoader.js';

// 📢 Общий логгер
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { getCurrentConfig } from './configLoader.js';

// ⚙️ Очереди
import {
  stopParseQueueWorker,
  startParseQueueWorker
} from '../queue/parseQueue.js';

// ✅ Валидация payload
import { validateEvent } from '../../../utils/eventSchemas.js';

const SERVICE_NAME = getCurrentConfig().service_name;

/**
 * 🚀 Запускает Redis Consumer:
 * - восстанавливает pending
 * - запускает основную подписку
 */
export async function startRedisConsumer() {
  // 🔁 Восстановление отложенных сообщений
  await recoverAllPendingMessages({
    consumer: SERVICE_NAME,
    maxPerStream: 1000,
    handler: async ({ type, payload }, meta) => {
      await processRedisCommand(type, payload);
      await ackMessage({ type, id: meta.id, serviceName: SERVICE_NAME });
    }
  });

  // 📡 Подписка на каждый тип команд (все три поддерживаемых)
  const commandTypes = ['subscribe_command', 'unsubscribe_command', 'config_update_command'];

  for (const type of commandTypes) {
    await consumeFromStream({
      type,
      consumer: SERVICE_NAME,
      handler: async ({ type, payload }, meta) => {
        await processRedisCommand(type, payload);
        await ackMessage({ type, id: meta.id, serviceName: SERVICE_NAME });
      }
    });
  }
}

/**
 * 🛑 Заглушка на будущее
 */
export async function stopRedisConsumer() {
  // 🔕
}

/**
 * 🧠 Обработка одной команды из Redis Stream
 */
async function processRedisCommand(type, payload) {
  // ✅ Валидация payload по схеме
  const { valid, missingFields } = validateEvent(type, payload);

  if (!valid) {
    await sharedLogger({
      service: SERVICE_NAME,
      level: 'warn',
      message: {
        type: 'invalid_payload',
        event: type,
        missingFields,
        payload,
      },
    });
    return;
  }

  // 📥 Лог: команда получена
  await sharedLogger({
    service: SERVICE_NAME,
    level: 'info',
    message: { type: `${type}_received`, payload },
  });

  switch (type) {
    /**
     * 📌 Подписка на аккаунт
     */
    case 'subscribe_command':
      if (payload.priority === true) {
        try {
          const { markAccountAsPrioritized } = await import('../queue/perAccountPublishQueueManager.js');
          markAccountAsPrioritized(payload.chain_id, payload.account);

          await sharedLogger({
            service: SERVICE_NAME,
            level: 'info',
            message: {
              type: 'subscribe_priority_marked',
              chain_id: payload.chain_id,
              account: payload.account,
            },
          });
        } catch (err) {
          await sharedLogger({
            service: SERVICE_NAME,
            level: 'error',
            message: {
              type: 'subscribe_priority_failed',
              error: err.message,
            },
          });
        }
      }

      await subscribeToAccount({
        chain_id: payload.chain_id,
        account: payload.account,
        last_signature: payload.last_signature,
        history_max_age_ms: payload.history_max_age_ms,
        priority: payload.priority === true,
      });
      break;

    /**
     * 🛑 Отписка от аккаунта
     */
    case 'unsubscribe_command':
      await unsubscribeFromAccount(`${payload.chain_id}:${payload.account}`);
      break;

    /**
     * 🔄 Обновление конфигурации
     * Обновляет только нужные модули
     */
    case 'config_update_command': {
      const { old, updated } = await updateAndReloadConfig();

      if (old.silence_threshold_ms !== updated.silence_threshold_ms) {
        await sharedLogger({
          service: updated.service_name,
          level: 'info',
          message: {
            type: 'silence_threshold_updated',
            from: old.silence_threshold_ms,
            to: updated.silence_threshold_ms,
          },
        });
      }

      if (old.parse_concurrency !== updated.parse_concurrency) {
        stopParseQueueWorker();
        startParseQueueWorker();

        await sharedLogger({
          service: updated.service_name,
          level: 'info',
          message: {
            type: 'parse_queue_concurrency_updated',
            from: old.parse_concurrency,
            to: updated.parse_concurrency,
          },
        });
      }

      const controlsChanged = JSON.stringify(old.control_accounts) !== JSON.stringify(updated.control_accounts);

      if (controlsChanged) {
        await resubscribeAll();

        await sharedLogger({
          service: updated.service_name,
          level: 'info',
          message: {
            type: 'control_accounts_updated',
            old: old.control_accounts,
            new: updated.control_accounts,
          },
        });
      }

      break;
    }
  }
}
