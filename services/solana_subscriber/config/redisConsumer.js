import { createClient } from 'redis';
import { subscribeToAccount, unsubscribeFromAccount, resubscribeAll } from '../subscription/subscriptionManager.js';
import { updateAndReloadConfig } from './configLoader.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';

const SERVICE_NAME = 'solana_subscriber';
const REDIS_STREAM_KEY = 'subscriber_control';
let redisClient;
let running = false;

export async function startRedisConsumer() {
  redisClient = createClient({ url: 'redis://redis:6379' });
  await redisClient.connect();
  running = true;
  pollStream(redisClient);
}

export async function stopRedisConsumer() {
  running = false;
  if (redisClient) await redisClient.quit();
}

async function pollStream(client, lastId = '$') {
  while (running) {
    try {
      const response = await client.xRead(
        { key: REDIS_STREAM_KEY, id: lastId },
        { BLOCK: 5000, COUNT: 10 }
      );

      if (!response) {
        running = false;
        break;
      }

      for (const stream of response) {
        for (const [id, entry] of stream.messages) {
          const payload = JSON.parse(entry.data.data);

          switch (payload.action) {
            case 'subscribe':
              await sharedLogger({
                service: SERVICE_NAME,
                level: 'info',
                message: { type: 'subscribe_command', payload },
              });

              await subscribeToAccount({
                chain_id: payload.chain_id,
                account: payload.account,
                subscription_type: payload.subscription_type,
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
              await sharedLogger({
                service: SERVICE_NAME,
                level: 'info',
                message: { type: 'config_update_command' },
              });

              await updateAndReloadConfig();
              await resubscribeAll();
              break;

            default:
              await sharedLogger({
                service: SERVICE_NAME,
                level: 'warn',
                message: { type: 'unknown_command', payload },
              });
          }

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

export { pollStream };

export function setRunning(value) {
  running = value;
}
