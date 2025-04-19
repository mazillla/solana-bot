// ✅ ОБНОВЛЁННЫЙ

import os from 'os';
import { sharedLogger } from './sharedLogger.js';
import { getCurrentConfig } from '../services/solana_subscriber/config/configLoader.js';
import { getRedisClient } from './redisClientSingleton.js';

let heartbeatInterval = null;

/**
 * 🚀 Запускает heartbeat-отправку сообщений в Redis Stream.
 * 
 * @param {string} serviceName — Имя текущего сервиса (например: solana_subscriber)
 */
export async function startHeartbeat(serviceName) {
  const instanceId = `${serviceName}@${os.hostname()}:${process.pid}`;
  let streamKey = 'system_heartbeat';
  let intervalMs = 30000;

  try {
    const config = getCurrentConfig();
    streamKey = config.heartbeat_stream_key || streamKey;
    intervalMs = config.heartbeat_interval_ms || intervalMs;
  } catch (err) {
    try {
      await sharedLogger({
        service: serviceName,
        level: 'warn',
        message: {
          type: 'heartbeat_config_missing',
          error: err.message,
        },
      });
    } catch (_) {}
  }

  heartbeatInterval = setInterval(async () => {
    const message = {
      type: 'HEARTBEAT',
      service: serviceName,
      instance_id: instanceId,
      timestamp: Date.now(),
    };

    // ✅ Валидация сообщения перед отправкой
    if (typeof message !== 'object' || message === null) {
      await sharedLogger({
        service: serviceName,
        level: 'warn',
        message: {
          type: 'heartbeat_skipped',
          reason: 'invalid_message_object',
        },
      });
      return;
    }

    try {
      const redis = await getRedisClient();
      await redis.xAdd(streamKey, '*', {
        data: JSON.stringify(message),
      });

    } catch (err) {
      try {
        await sharedLogger({
          service: serviceName,
          level: 'error',
          message: {
            type: 'heartbeat_publish_failed',
            error: err.message,
          },
        });
      } catch (_) {}
    }
  }, intervalMs);
}

/**
 * 🛑 Останавливает отправку heartbeat-сообщений
 */
export async function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}
