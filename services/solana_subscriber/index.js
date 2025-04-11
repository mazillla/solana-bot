import { loadSubscriberConfig } from './config/configLoader.js';
import { initRpcPool, closeRpcPool } from './rpc/rpcPool.js';
import { getActiveSubscriptions } from './db/subscriptions.js';
import { startRedisConsumer, stopRedisConsumer } from './config/redisConsumer.js';
import { startAllSubscriptions, stopAllSubscriptions } from './subscription/subscriptionManager.js';
import { startOnLogsQueueWorker, stopOnLogsQueueWorker } from './queue/onLogsQueueWorker.js';
import { startRedisRetryWorker, stopRedisRetryWorker } from './queue/redisRetryQueue.js';
import { sharedLogger } from '../../utils/sharedLogger.js';
import { initPostgres, closePostgres } from './db/db.js';

let shuttingDown = false;
const SERVICE_NAME = 'solana_subscriber';

async function init() {
  try {
    await sharedLogger({ service: SERVICE_NAME, level: 'info', message: '🔧 Инициализация solana_subscriber...' });

    await initPostgres();

    const config = await loadSubscriberConfig();
    await sharedLogger({ service: SERVICE_NAME, level: 'info', message: '✅ Конфигурация загружена' });

    await initRpcPool(config.rpc_endpoints);

    const subscriptions = await getActiveSubscriptions();
    await sharedLogger({ service: SERVICE_NAME, level: 'info', message: `🔌 Найдено ${subscriptions.length} активных подписок` });

    await startAllSubscriptions(subscriptions);

    startRedisConsumer();
    startOnLogsQueueWorker();
    startRedisRetryWorker();

    await sharedLogger({ service: SERVICE_NAME, level: 'info', message: '🚀 solana_subscriber успешно запущен' });
  } catch (err) {
    await sharedLogger({ service: SERVICE_NAME, level: 'error', message: `Ошибка при инициализации: ${err.message}` });
    process.exit(1);
  }
}

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  await sharedLogger({ service: SERVICE_NAME, level: 'info', message: '🧼 Завершение работы...' });

  try {
    await stopRedisConsumer();
    stopOnLogsQueueWorker();
    stopRedisRetryWorker();
    await stopAllSubscriptions();
    await closeRpcPool();
    await closePostgres();

    await sharedLogger({ service: SERVICE_NAME, level: 'info', message: '✅ Завершено корректно' });
    process.exit(0);
  } catch (err) {
    await sharedLogger({ service: SERVICE_NAME, level: 'error', message: `Ошибка при завершении: ${err.message}` });
    process.exit(1);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

init();
