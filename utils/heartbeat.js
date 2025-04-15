// utils/heartbeat.js
import os from 'os';
import { sharedLogger } from './sharedLogger.js';
import { getCurrentConfig } from '../services/solana_subscriber/config/configLoader.js';
import { getRedisClient } from './redisClientSingleton.js';

let heartbeatInterval = null;

export async function startHeartbeat(serviceName) {
  const instanceId = `${serviceName}@${os.hostname()}:${process.pid}`;
  const streamKey = 'system_heartbeat';

  let intervalMs = 30000;
  try {
    const config = getCurrentConfig();
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
    try {
      const redis = await getRedisClient();

      const message = {
        type: 'HEARTBEAT',
        service: serviceName,
        instance_id: instanceId,
        timestamp: Date.now(),
      };

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

export async function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  // ❌ Закрытие Redis клиента больше не нужно здесь — делается централизованно
}
