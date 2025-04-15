// services/solana_subscriber/subscription/recoveryManager.js
import { getSignaturesForAddressWithTimeout } from '../rpc/rpcUtils.js';
import { getAvailableRpc } from '../rpc/rpcPool.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { enqueueSignature } from '../queue/parseQueue.js';
import { enqueueToPerAccountQueue, isPrioritized } from '../queue/perAccountQueueManager.js';
import { getCurrentConfig } from '../config/configLoader.js';

const SERVICE_NAME = 'solana_subscriber';

export async function recoverTransactions({ chain_id, account, last_signature, subscription_type }) {
  const rpc = await getAvailableRpc();
  if (!rpc) {
    try {
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
    } catch (_) {}
    return;
  }

  try {
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
  } catch (_) {}

  const allSignatures = [];
  const maxAgeMs = getCurrentConfig().default_history_max_age_ms || 86400000;
  const now = Date.now();

  let before = undefined;
  let keepFetching = true;

  while (keepFetching) {
    const options = {
      limit: 1000,
      ...(before ? { before } : {}),
      ...(last_signature ? { until: last_signature } : {}),
    };

    const sigs = await getSignaturesForAddressWithTimeout(rpc, account, options);
    if (!sigs || sigs.length === 0) break;

    const confirmed = sigs.filter(sig => sig.confirmationStatus === 'confirmed');

    for (const sig of confirmed) {
      if (sig.signature === last_signature) {
        keepFetching = false;
        break;
      }
      if (sig.blockTime && sig.blockTime * 1000 < now - maxAgeMs) {
        keepFetching = false;
        break;
      }

      allSignatures.push(sig);
    }

    if (sigs.length < 1000) break;
    before = sigs[sigs.length - 1].signature;
  }

  const ordered = allSignatures.sort((a, b) => a.slot - b.slot);

  for (const sig of ordered) {
    const task = {
      chain_id,
      account,
      signature: sig.signature,
      enqueuedAt: Date.now(),
    };

    if (isPrioritized(chain_id, account)) {
      enqueueToPerAccountQueue(task);
    } else {
      enqueueSignature(task);
    }
  }

  try {
    await sharedLogger({
      service: SERVICE_NAME,
      level: 'info',
      message: {
        type: 'recovery_queued',
        chain_id,
        account,
        count: ordered.length,
      },
    });
  } catch (_) {}
}
