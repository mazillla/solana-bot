import { connectionFactory } from './connectionFactory.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { resubscribeAll } from '../subscription/subscriptionManager.js';
import {
  initRpcPool as coreInitRpcPool,
  getAllRpcClients,
  getAvailableRpc,
  getWsConnections,
  closeRpcPool,
} from './rpcPoolCore.js';

let reconnectInProgress = false;

export async function initRpcPool(endpoints) {
  await coreInitRpcPool(endpoints, connectionFactory);

  for (const rpc of getAllRpcClients()) {
    const ws = rpc.wsConn._rpcWebSocket;
    if (ws) {
      ws.on('close', () => handleDisconnect(rpc.id));
      ws.on('error', () => handleDisconnect(rpc.id));
    }
  }

  console.log(`🌐 Инициализировано ${getAllRpcClients().length} RPC`);
}

async function handleDisconnect(rpcId) {
  if (reconnectInProgress) return;
  reconnectInProgress = true;

  await sharedLogger({
    service: 'solana_subscriber',
    level: 'warn',
    message: {
      type: 'ws_disconnect',
      rpc_id: rpcId,
    },
  });

  try {
    await closeRpcPool();

    const { rpc_endpoints } = await import('../config/configLoader.js').then((m) =>
      m.getCurrentConfig()
    );

    await initRpcPool(rpc_endpoints);
    await resubscribeAll();

    await sharedLogger({
      service: 'solana_subscriber',
      level: 'info',
      message: {
        type: 'reconnect',
        rpc_id: rpcId,
      },
    });
  } catch (err) {
    await sharedLogger({
      service: 'solana_subscriber',
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

export function __setReconnectInProgress(val) {
  reconnectInProgress = val;
}

export {
  getAllRpcClients,
  getWsConnections,
  getAvailableRpc,
  closeRpcPool,
  handleDisconnect,
};
