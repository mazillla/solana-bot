import { getCurrentConfig } from '../config/configLoader.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { withAbortTimeout } from '../../../utils/withAbortTimeout.js';

const SERVICE_NAME = 'solana_subscriber';

export async function getParsedTransactionWithTimeout(rpc, signature) {
  const timeoutMs = getCurrentConfig().rpc_timeout_ms || 5000;

  try {
    return await withAbortTimeout(async (_signal) => {
      return await rpc.httpConn.getParsedTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
    }, timeoutMs);
  } catch (err) {
    try {
      await sharedLogger({
        service: SERVICE_NAME,
        level: 'warn',
        message: {
          type: 'rpc_timeout',
          rpc_id: rpc.id,
          method: 'getParsedTransaction',
          signature,
          error: err.message,
        },
      });
    } catch (_) {}
    return null;
  }
}

export async function getSignaturesForAddressWithTimeout(rpc, address, options = {}) {
  const timeoutMs = getCurrentConfig().rpc_timeout_ms || 5000;

  try {
    return await withAbortTimeout(async (_signal) => {
      return await rpc.httpConn.getSignaturesForAddress(address, options);
    }, timeoutMs);
  } catch (err) {
    try {
      await sharedLogger({
        service: SERVICE_NAME,
        level: 'warn',
        message: {
          type: 'rpc_timeout',
          rpc_id: rpc.id,
          method: 'getSignaturesForAddress',
          address: address.toBase58?.() || address,
          error: err.message,
        },
      });
    } catch (_) {}
    return null;
  }
}
