import { getCurrentConfig } from '../config/configLoader.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';

const SERVICE_NAME = 'solana_subscriber';

export function withTimeout(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`RPC timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((res) => {
        clearTimeout(timeout);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timeout);
        reject(err);
      });
  });
}

export async function getParsedTransactionWithTimeout(rpc, signature) {
  const timeoutMs = getCurrentConfig().rpc_timeout_ms || 5000;

  try {
    return await withTimeout(
      rpc.httpConn.getParsedTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      }),
      timeoutMs
    );
  } catch (err) {
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
    return null;
  }
}

export async function getSignaturesForAddressWithTimeout(rpc, address, options = {}) {
  const timeoutMs = getCurrentConfig().rpc_timeout_ms || 5000;

  try {
    return await withTimeout(
      rpc.httpConn.getSignaturesForAddress(address, options),
      timeoutMs
    );
  } catch (err) {
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
    return null;
  }
}
