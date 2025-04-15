// services/solana_subscriber/config/redisConsumer.js
import { getRedisClient } from '../../../utils/redisClientSingleton.js';
import { subscribeToAccount, unsubscribeFromAccount, resubscribeAll } from '../subscription/subscriptionManager.js';
import { updateAndReloadConfig } from './configLoader.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';

const SERVICE_NAME = 'solana_subscriber';
const REDIS_STREAM_KEY = 'subscriber_control';
let redisClient;
let running = false;

export async function startRedisConsumer() {
  redisClient = await getRedisClient();
  running = true;
  pollStream(redisClient);
}

export async function stopRedisConsumer() {
  running = false;
  // Закрытие redisClient теперь централизованное через shutdown()
}

export function setRunning(value) {
  running = value;
}

export async function pollStream(client, lastId = '$') {
  while (running) {
    try {
      const response = await client.xRead(
        { key: REDIS_STREAM_KEY, id: lastId },
        { BLOCK: 5000, COUNT: 10 }
      );

      if (!response) continue;

      for (const stream of response) {
        for (const [id, entry] of stream.messages) {
          const payload = JSON.parse(entry.data.data);
          await processRedisCommand(payload);
          lastId = id;
        }
      }
    } catch (err) {
      await sharedLogger({
        service: SERVICE_NAME,
        level: 'error',
        message: {
          type: 'redis_consumer_error',
          error: err.message,
        },
      });
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

export async function processRedisCommand(payload) {
  switch (payload.action) {
    case 'subscribe':
      await sharedLogger({
        service: SERVICE_NAME,
        level: 'info',
        message: { type: 'subscribe_command', payload },
      });

      if (payload.priority === true) {
        try {
          const { markAccountAsPrioritized } = await import('../queue/perAccountQueueManager.js');
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
          try {
            await sharedLogger({
              service: SERVICE_NAME,
              level: 'error',
              message: {
                type: 'subscribe_priority_failed',
                error: err.message,
              },
            });
          } catch (_) {}
        }
      }

      await subscribeToAccount({
        chain_id: payload.chain_id,
        account: payload.account,
        last_signature: payload.last_signature,
        history_max_age_ms: payload.history_max_age_ms,
      });
      break;

    case 'unsubscribe':
      await sharedLogger({
        service: SERVICE_NAME,
        level: 'info',
        message: { type: 'unsubscribe_command', payload },
      });

      await unsubscribeFromAccount(`${payload.chain_id}:${payload.account}`);
      break;

    case 'update_config':
      await handleUpdateConfigCommand();
      break;

    default:
      await sharedLogger({
        service: SERVICE_NAME,
        level: 'warn',
        message: { type: 'unknown_command', payload },
      });
  }
}

export async function handleUpdateConfigCommand() {
  await sharedLogger({
    service: SERVICE_NAME,
    level: 'info',
    message: { type: 'config_update_command' },
  });

  await updateAndReloadConfig();
  await resubscribeAll();
}
