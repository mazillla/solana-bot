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

import { handleDisconnect } from './handleDisconnect.js'; // ✅ подключаем вынесенную логику

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

export function __setReconnectInProgress(val) {
  reconnectInProgress = val;
}

export {
  getAllRpcClients,
  getWsConnections,
  getAvailableRpc,
  closeRpcPool,
};
