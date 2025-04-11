import { createLimiter } from './rpcLimiter.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';


const rpcPool = [];

export function getAllRpcClients() {
  return rpcPool;
}

export function getWsConnections() {
  return rpcPool.map((r) => r.wsConn);
}

export async function initRpcPool(endpoints, connectionFactory) {
  rpcPool.length = 0;

  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    const rpcId = `rpc-${i + 1}`;

    const limiter = createLimiter(endpoint.rate_limits?.max_requests_per_sec || 10);
    const httpConn = connectionFactory(endpoint.http);
    const wsConn = connectionFactory(endpoint.http, endpoint.ws);

    rpcPool.push({
      id: rpcId,
      httpConn,
      wsConn,
      limiter,
    });

    // return ws to upper level to attach listeners
    const ws = wsConn._rpcWebSocket;
    if (ws) {
      ws.rpcId = rpcId; // allow upper layer to track
    }
  }
}

export async function closeRpcPool() {
  for (const rpc of rpcPool) {
    try {
      rpc.wsConn._rpcWebSocket?.close();
    } catch (err) {
      await sharedLogger({
        service: 'solana_subscriber',
        level: 'warn',
        message: {
          type: 'ws_close_failed',
          rpc_id: rpc.id,
          error: err.message,
        },
      });
    }
  }
}

export async function getAvailableRpc() {
  for (const rpc of rpcPool) {
    if (rpc.limiter.removeToken()) {
      return rpc;
    }
  }
  return null;
}
