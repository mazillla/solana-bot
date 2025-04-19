// services/solana_subscriber/start.js

// 📦 Подключение модулей БД
import { initPostgres, closePostgres } from './db/db.js';

// 📥 Загрузка конфигурации
import { loadSubscriberConfig, getCurrentConfig } from './config/configLoader.js';

// 🔌 RPC
import { initRpcPool, closeRpcPool } from './rpc/rpcPool.js';

// 📡 Подписки
import {
  startAllSubscriptions,
  stopAllSubscriptions,
} from './subscription/subscriptionManager.js';

// 🧾 Получение подписок из БД
import { getActiveSubscriptions } from './db/subscriptions.js';

// 🔄 Очереди
import { startParseQueueWorker } from './queue/parseQueue.js';
import { startPublishQueueWorker } from './queue/publishQueue.js';
import { startSignatureUpdateWorker } from './queue/signatureUpdateBuffer.js';

// 📬 Redis consumer (команды)
import {
  startRedisConsumer,
  stopRedisConsumer,
} from './config/redisConsumer.js';

// ❤️ Heartbeat в Redis
import { startHeartbeat, stopHeartbeat } from '../../utils/heartbeat.js';

// 🔌 Redis client (singleton)
import { getRedisClient, disconnectRedisClient } from '../../utils/redisClientSingleton.js';

// 📢 Логирование
import { sharedLogger } from '../../utils/sharedLogger.js';

// 🧠 Новый шаг — верификатор подписок (каждые N мс сверяет WS-подписки)
import { startWsSubscriptionVerifier, stopWsSubscriptionVerifier } from './subscription/wsSubscriptionVerifier.js';

// 🔐 Флаг корректного завершения
let shuttingDown = false;

/**
 * 🚀 Запуск микросервиса `solana_subscriber`
 */
export async function start() {
  try {
    // 1️⃣ Загрузка конфигурации (в первую очередь!)
    try {
      await loadSubscriberConfig(); // нужно для getCurrentConfig()
      await sharedLogger({
        service: getCurrentConfig().service_name,
        level: 'info',
        message: '⚙ Инициализация микросервиса...',
      });
    } catch (err) {
      // Если sharedLogger сам не сработал — fallback лог
      try {
        await sharedLogger({
          service: 'solana_subscriber',
          level: 'error',
          message: {
            type: 'shared_logger_init_failed',
            error: err.message,
          },
        });
      } catch (_) {}
      process.exit(1);
      return;
    }

    // 2️⃣ Инфраструктура
    await getRedisClient();      // Redis
    await initPostgres();        // PostgreSQL

    // 3️⃣ RPC
    const config = getCurrentConfig();
    await initRpcPool(config.rpc_endpoints);

    // 4️⃣ Подписки из базы
    const subscriptions = await getActiveSubscriptions();
    if (subscriptions?.length) {
      await startAllSubscriptions(subscriptions);
    }

    // 5️⃣ Очереди + воркеры
    await startRedisConsumer();       // Подписка на команды
    startParseQueueWorker();          // Обработка сигнатур
    startPublishQueueWorker();        // Публикация транзакций
    startSignatureUpdateWorker();     // Повторные попытки updateLastSignature

    // 6️⃣ ❤️ Heartbeat в Redis
    await startHeartbeat(config.service_name);

    // 7️⃣ 🧠 Верификатор WebSocket-подписок (новый шаг)
    startWsSubscriptionVerifier();

    // ✅ Успешный запуск
    try {
      await sharedLogger({
        service: config.service_name,
        level: 'info',
        message: '🚀 solana_subscriber успешно запущен',
      });
    } catch (_) {}
  } catch (err) {
    try {
      await sharedLogger({
        service: getCurrentConfig().service_name,
        level: 'error',
        message: {
          type: 'startup_failed',
          error: err.message,
        },
      });
    } catch (_) {}
    process.exit(1);
  }
}

/**
 * 🛑 Корректное завершение работы сервиса
 */
export async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;

  try {
    await stopRedisConsumer();
    await stopAllSubscriptions();
    await closeRpcPool();
    await closePostgres();
    await stopHeartbeat();
    stopWsSubscriptionVerifier();       // 🧠 Остановка проверки подписок
    await disconnectRedisClient();      // Redis shutdown

    try {
      await sharedLogger({
        service: getCurrentConfig().service_name,
        level: 'info',
        message: '✅ Завершено корректно',
      });
    } catch (_) {}

    process.exit(0);
  } catch (err) {
    try {
      await sharedLogger({
        service: getCurrentConfig().service_name,
        level: 'error',
        message: {
          type: 'shutdown_failed',
          error: err.message,
        },
      });
    } catch (_) {}

    process.exit(1);
  }
}
