// utils/redisStreamBus.js

// 📦 Redis клиент через singleton
import { getRedisClient } from './redisClientSingleton.js';

// 🧠 Централизованный логгер
import { sharedLogger } from './sharedLogger.js';

/// ------------------------------------------------------------------------
/// 🔁 МАРШРУТИЗАЦИЯ ПОТОКОВ И ГРУПП
/// ------------------------------------------------------------------------

const STREAM_ROUTING = {
  subscribe_command: 'subscriber_control',
  unsubscribe_command: 'subscriber_control',
  config_update_command: 'subscriber_control',
  transaction_published: 'transaction_stream',
  subscription_state_changed: 'subscriber_subscription_state',
};

const GROUP_ROUTING = {
  subscribe_command: 'subscriber_runtime',
  unsubscribe_command: 'subscriber_runtime',
  config_update_command: 'subscriber_runtime',
  transaction_published: 'analyzer_group',
  subscription_state_changed: 'ui_state_syncer',
};

const MAXLEN = 10000;
const APPROXIMATE = true;
const initializedGroups = new Set();

/// ------------------------------------------------------------------------
/// 🧪 Валидация payload перед отправкой
/// ------------------------------------------------------------------------

function isValidPayload(payload) {
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload);
}

/// ------------------------------------------------------------------------
/// 🧱 Убедиться, что группа существует
/// ------------------------------------------------------------------------

async function ensureGroupExists({ stream, group, service }) {
  const redis = await getRedisClient();
  const groupKey = `${stream}::${group}`;
  if (initializedGroups.has(groupKey)) return;

  try {
    await redis.xGroupCreate(stream, group, '$', { MKSTREAM: true });
  } catch (err) {
    if (!err?.message?.includes('BUSYGROUP')) {
      await sharedLogger({
        service,
        level: 'error',
        message: {
          type: 'stream_group_create_failed',
          stream,
          group,
          error: err.message,
        },
      });
    }
  }

  initializedGroups.add(groupKey);
}

/// ------------------------------------------------------------------------
/// 📤 Публикация события в Redis Stream
/// ------------------------------------------------------------------------

export async function publishToStream({ service, type, payload, stream, group }) {
  const resolvedStream = stream || STREAM_ROUTING[type];
  const resolvedGroup = group || GROUP_ROUTING[type];

  // 🚧 Проверка — известный ли поток и группа
  if (!resolvedStream || !resolvedGroup) {
    await sharedLogger({
      service,
      level: 'warn',
      message: {
        type: 'stream_publish_skipped',
        reason: 'unknown_type_or_group',
        input: { type, stream, group },
      },
    });
    return;
  }

  // 🚧 Проверка — является ли payload валидным объектом
  if (!isValidPayload(payload)) {
    await sharedLogger({
      service,
      level: 'warn',
      message: {
        type: 'stream_publish_skipped',
        reason: 'invalid_payload',
        payloadType: typeof payload,
        type,
      },
    });
    return;
  }

  // ✅ Убедиться, что группа создана
  await ensureGroupExists({ stream: resolvedStream, group: resolvedGroup, service });

  const redis = await getRedisClient();
  const message = {
    type,
    service,
    timestamp: Date.now(),
    payload,
  };

  try {
    await redis.xAdd(resolvedStream, '*', { data: JSON.stringify(message) }, {
      MAXLEN,
      approximate: APPROXIMATE,
    });
  } catch (err) {
    await sharedLogger({
      service,
      level: 'error',
      message: {
        type: 'stream_publish_failed',
        stream: resolvedStream,
        group: resolvedGroup,
        error: err.message,
      },
    });
  }
}
