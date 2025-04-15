import { createLimiter } from './rpcLimiter.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';

const rpcPool = [];

export async function initRpcPool(endpoints, connectionFactory) {
  rpcPool.length = 0;

  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    const rpcId = `rpc-${i + 1}`;

    const httpLimiter = createLimiter(endpoint.rate_limits?.http || 10);
    const wsLimiter = createLimiter(endpoint.rate_limits?.ws || 5);

    const httpConn = connectionFactory(endpoint.http);
    const wsConn = connectionFactory(endpoint.http, endpoint.ws);

    rpcPool.push({
      id: rpcId,
      httpConn,
      wsConn,
      httpLimiter,
      wsLimiter,
    });

    const ws = wsConn._rpcWebSocket;
    if (ws) {
      ws.rpcId = rpcId;
    }
  }
}
