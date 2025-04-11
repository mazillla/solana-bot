import { getSignaturesForAddressWithTimeout, getParsedTransactionWithTimeout } from '../rpc/rpcUtils.js';
import { getAvailableRpc } from '../rpc/rpcPool.js';
import { redisPublishLog } from '../utils/redisLogSender.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { updateLastSignature } from '../db/subscriptions.js';
import { getCurrentConfig } from '../config/configLoader.js';

const SERVICE_NAME = 'solana_subscriber';

export async function recoverTransactions({ chain_id, account, last_signature, subscription_type }) {
  const rpc = await getAvailableRpc();
  if (!rpc) {
    await sharedLogger({
      service: SERVICE_NAME,
      level: 'warn',
      message: {
        type: 'recovery_skipped',
        reason: 'no_available_rpc',
        chain_id,
        account,
      },
    });
    return;
  }

  await sharedLogger({
    service: SERVICE_NAME,
    level: 'info',
    message: {
      type: 'recovery_started',
      chain_id,
      account,
      rpc_id: rpc.id,
      from: last_signature || 'start',
    },
  });

  const options = last_signature ? { until: last_signature, limit: 1000 } : { limit: 1000 };
  const signatures = await getSignaturesForAddressWithTimeout(rpc, account, options);
  if (!signatures || signatures.length === 0) return;

  const ordered = signatures
    .filter(sig => sig.confirmationStatus === 'confirmed')
    .sort((a, b) => a.slot - b.slot);

  for (const sig of ordered) {
    const parsed = await getParsedTransactionWithTimeout(rpc, sig.signature);
    if (!parsed || parsed.meta?.err) continue;

    const blockTime = parsed.blockTime || null;
    const timestamp = blockTime ? blockTime * 1000 : Date.now();

    const message = {
      chain_id,
      account,
      signature: sig.signature,
      log: parsed,
      subscription_type,
      blockTime,
      timestamp,
    };

    const streamKey = subscription_type === 'spl_token' ? 'solana_logs_spl' : 'solana_logs_regular';

    try {
      await redisPublishLog(streamKey, message);
      await updateLastSignature(chain_id, account, sig.signature);

      await sharedLogger({
        service: SERVICE_NAME,
        level: 'info',
        message: {
          type: 'recovery_dispatched',
          chain_id,
          account,
          signature: sig.signature,
          rpc_id: rpc.id,
        },
      });
    } catch (err) {
      await sharedLogger({
        service: SERVICE_NAME,
        level: 'error',
        message: {
          type: 'recovery_publish_failed',
          signature: sig.signature,
          error: err.message,
        },
      });
    }
  }

  await sharedLogger({
    service: SERVICE_NAME,
    level: 'info',
    message: {
      type: 'recovery_completed',
      chain_id,
      account,
      recovered_count: ordered.length,
    },
  });
}
