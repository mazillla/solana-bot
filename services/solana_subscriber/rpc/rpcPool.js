// services/solana_subscriber/rpc/rpcPool.js

// ✅ ГОТОВ

/**
 * Модуль управления пулом RPC-клиентов для Solana.
 *
 * 💡 Поддерживает:
 * - работу с несколькими RPC-эндпоинтами
 * - лимитирование запросов (HTTP и WebSocket)
 * - автоматическое восстановление соединений
 * - интеграцию с подписками и логированием
 */

import { Connection } from '@solana/web3.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { getCurrentConfig } from '../config/configLoader.js';
import { sendSubscriptionStateUpdate } from '../utils/subscriptionStatePublisher.js';
import { resubscribeAll } from '../subscription/subscriptionManager.js';
import { createLimiter } from './rpcLimiter.js';

const rpcPool = []; // 🧠 массив активных RPC клиентов
let reconnectInProgress = false; // 🔐 флаг защиты от повторного reconnect

/**
 * ⚙️ Создаёт RPC-соединение с HTTP и (опционально) WebSocket
 * 
 * @param {string} httpUrl - URL HTTP RPC (обязательно)
 * @param {string|null} wsUrl - URL WebSocket RPC (если есть)
 * @returns {Connection}
 */
function connectionFactory(httpUrl, wsUrl = null) {
  return new Connection(httpUrl, {
    commitment: 'confirmed',
    ...(wsUrl ? { wsEndpoint: wsUrl } : {}), // поддержка WS если задан
  });
}

/**
 * 🔁 Инициализация пула RPC клиентов.
 * Используется при старте или пересоздании после сбоя.
 * 
 * @param {Array} endpoints - список RPC-объектов из subscriber_config
 */
export async function initRpcPool(endpoints) {
  rpcPool.length = 0; // очищаем старый пул

  const {
    http_limit_per_sec = 10,
    ws_limit_per_sec = 5,
  } = getCurrentConfig(); // лимиты из базы

  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    const rpcId = `rpc-${i + 1}`;

    // 🧰 лимитеры для защиты от rate limit
    const httpLimiter = createLimiter(http_limit_per_sec);
    const wsLimiter = createLimiter(ws_limit_per_sec);

    // 🌐 создаём соединения
    const httpConn = connectionFactory(endpoint.http);
    const wsConn = connectionFactory(endpoint.http, endpoint.ws);

    rpcPool.push({
      id: rpcId,
      httpConn,
      wsConn,
      httpLimiter,
      wsLimiter,
    });

    // 📡 обрабатываем события отключения WS
    const ws = wsConn._rpcWebSocket;
    if (ws) {
      ws.rpcId = rpcId;
      ws.on('close', () => handleDisconnect(rpcId));
      ws.on('error', () => handleDisconnect(rpcId));
    }
  }
}

/**
 * 🎲 Возвращает доступный RPC клиент.
 * Сейчас — случайный. При одном RPC — всегда он.
 */
export function getAvailableRpc() {
  if (!rpcPool.length) return null;
  return rpcPool[Math.floor(Math.random() * rpcPool.length)];
}

/**
 * 📋 Возвращает все RPC клиенты (для мониторинга или диагностики)
 */
export function getAllRpcClients() {
  return rpcPool;
}

/**
 * 📡 Возвращает все WebSocket соединения (для подписок)
 */
export function getWsConnections() {
  return rpcPool.map(rpc => rpc.wsConn);
}

/**
 * 🧹 Закрывает все RPC соединения и очищает пул.
 * Используется при reconnect или завершении работы.
 */
export async function closeRpcPool() {
  for (const rpc of rpcPool) {
    rpc.httpLimiter?.stop?.();
    rpc.wsLimiter?.stop?.();

    try {
      await rpc.wsConn._rpcWebSocket?.close(); // закрываем WS
    } catch (_) {}
  }
  rpcPool.length = 0;
}

/**
 * ♻️ Обрабатывает отключение WebSocket соединения.
 * 🔐 Защищает от повторных вызовов через reconnectInProgress.
 * 
 * - Закрывает все соединения
 * - Пересоздаёт пул
 * - Восстанавливает подписки
 */
export async function handleDisconnect(rpcId) {
  if (reconnectInProgress) {
    try {
      await sharedLogger({
        service: getCurrentConfig().service_name,
        level: 'warn',
        message: {
          type: 'duplicate_disconnect_skipped',
          rpc_id: rpcId,
        },
      });
    } catch (_) {}
    return;
  }

  reconnectInProgress = true;

  try {
    // ⚠️ логируем отключение
    await sharedLogger({
      service: getCurrentConfig().service_name,
      level: 'warn',
      message: {
        type: 'ws_disconnect',
        rpc_id: rpcId,
      },
    });

    // 🧹 закрываем все RPC
    await closeRpcPool();

    // 🔁 пересоздаём из актуального конфига
    const { rpc_endpoints } = getCurrentConfig();
    await initRpcPool(rpc_endpoints);

    // ♻️ пересоздаём подписки
    await resubscribeAll();

    await sharedLogger({
      service: getCurrentConfig().service_name,
      level: 'info',
      message: {
        type: 'reconnect',
        rpc_id: rpcId,
      },
    });

  } catch (err) {
    await sharedLogger({
      service: getCurrentConfig().service_name,
      level: 'error',
      message: {
        type: 'reconnect_failed',
        rpc_id: rpcId,
        error: err.message,
      },
    });
  } finally {
    reconnectInProgress = false;
  }
}
