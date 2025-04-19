// services/solana_subscriber/rpc/rpcUtils.js

// ✅ ГОТОВ

/**
 * 📦 Утилиты для безопасной работы с Solana RPC через web3.js
 *
 * 💡 Возможности:
 * - ограничение по времени (таймаут)
 * - логгирование RPC ошибок (с указанием метода и rpc_id)
 * - поддержка кастомного `commitment` (только в getParsedTransaction)
 */

import { getCurrentConfig } from '../config/configLoader.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { withAbortTimeout } from '../../../utils/withAbortTimeout.js';

/**
 * 🔍 Получает `ParsedTransaction` по сигнатуре с таймаутом и логгированием.
 *
 * @param {object} rpc - объект RPC из пула (httpConn, id и т.д.)
 * @param {string} signature - сигнатура транзакции (txid)
 * @returns {Promise<ParsedTransaction | null>}
 */
export async function getParsedTransactionWithTimeout(rpc, signature) {
  const config = getCurrentConfig();
  const timeoutMs = config.rpc_timeout_ms || 5000;
  const commitment = config.commitment || 'confirmed';

  try {
    return await withAbortTimeout(async (_signal) => {
      return await rpc.httpConn.getParsedTransaction(signature, {
        commitment,
        maxSupportedTransactionVersion: 0,
      });
    }, timeoutMs);
  } catch (err) {
    try {
      await sharedLogger({
        service: config.service_name,
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

/**
 * 📜 Получает список сигнатур для заданного адреса аккаунта (с таймаутом).
 *
 * @param {object} rpc - RPC-клиент из пула
 * @param {string | PublicKey} address - адрес аккаунта
 * @param {object} options - параметры запроса: { limit, before, until }
 * @returns {Promise<Array<ConfirmedSignatureInfo> | null>}
 */
export async function getSignaturesForAddressWithTimeout(rpc, address, options = {}) {
  const config = getCurrentConfig();
  const timeoutMs = config.rpc_timeout_ms || 5000;

  try {
    return await withAbortTimeout(async (_signal) => {
      return await rpc.httpConn.getSignaturesForAddress(address, options);
    }, timeoutMs);
  } catch (err) {
    try {
      await sharedLogger({
        service: config.service_name,
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
