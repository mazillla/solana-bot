// services/solana_subscriber/start.js
import { initPostgres, closePostgres } from './db/db.js';
import { loadSubscriberConfig } from './config/configLoader.js';
import { initRpcPool, closeRpcPool } from './rpc/rpcPool.js';
import { getActiveSubscriptions } from './db/subscriptions.js';
import {
  startAllSubscriptions,
  stopAllSubscriptions,
} from './subscription/subscriptionManager.js';
import { startParseQueueWorker } from './queue/parseQueue.js';
import { startPublishQueueWorker } from './queue/publishQueue.js';
import { startSignatureUpdateWorker } from './queue/signatureUpdateBuffer.js';
import {
  startRedisConsumer,
  stopRedisConsumer,
} from './config/redisConsumer.js';
import { startHeartbeat, stopHeartbeat } from '../../utils/heartbeat.js';
import { getRedisClient, disconnectRedisClient } from '../../utils/redisClientSingleton.js';
import { sharedLogger } from '../../utils/sharedLogger.js';

let shuttingDown = false;

export async function start() {
  try {
    try {
      await sharedLogger({
        service: 'solana_subscriber',
        level: 'info',
        message: '⚙ Инициализация микросервиса...',
      });
    } catch (err) {
      console.warn('❌ sharedLogger init failed:', err.message);
      process.exit(1);
      return;
    }

    await getRedisClient();       // ✅ централизованное подключение
    await initPostgres();         // ✅ база
    const config = await loadSubscriberConfig();
    await initRpcPool(config.rpc_endpoints); // ✅ RPC

    const subscriptions = await getActiveSubscriptions();
    if (subscriptions?.length) {
      await startAllSubscriptions(subscriptions);
    }

    await startRedisConsumer();   // ✅ команды из Redis
    startParseQueueWorker();      // ✅ очередь сигнатур
    startPublishQueueWorker();    // ✅ очередь транзакций
    startSignatureUpdateWorker(); // ✅ очередь updateLastSignature
    await startHeartbeat('solana_subscriber'); // ❤️

    try {
      await sharedLogger({
        service: 'solana_subscriber',
        level: 'info',
        message: '🚀 solana_subscriber успешно запущен',
      });
    } catch (_) {}
  } catch (err) {
    try {
      await sharedLogger({
        service: 'solana_subscriber',
        level: 'error',
        message: `❌ Ошибка при инициализации: ${err.message}`,
      });
    } catch (_) {}

    process.exit(1);
  }
}

export async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  try {
    await stopRedisConsumer();
    await stopAllSubscriptions();
    await closeRpcPool();
    await closePostgres();
    await stopHeartbeat();
    await disconnectRedisClient(); // ✅ централизованное отключение

    try {
      await sharedLogger({
        service: 'solana_subscriber',
        level: 'info',
        message: '✅ Завершено корректно',
      });
    } catch (_) {}

    process.exit(0);
  } catch (err) {
    try {
      await sharedLogger({
        service: 'solana_subscriber',
        level: 'error',
        message: `❌ Ошибка при завершении: ${err.message}`,
      });
    } catch (_) {}

    process.exit(1);
  }
}
