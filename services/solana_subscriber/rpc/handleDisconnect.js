import { closeRpcPool } from './rpcPoolCore.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { resubscribeAll } from '../subscription/subscriptionManager.js';
import { getCurrentConfig } from '../config/configLoader.js';

export async function handleDisconnect(rpcId) {
  try {
    await sharedLogger({
      service: 'solana_subscriber',
      level: 'warn',
      message: {
        type: 'ws_disconnect',
        rpc_id: rpcId,
      },
    });
  } catch (_) {}

  try {
    await closeRpcPool();

    const { rpc_endpoints } = getCurrentConfig();

    const { initRpcPool } = await import('./rpcPool.js');
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
  }
}
