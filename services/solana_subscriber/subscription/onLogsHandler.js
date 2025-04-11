import { getParsedTransactionWithTimeout } from '../rpc/rpcUtils.js';
import { scheduleRetry } from '../queue/retryQueue.js';
import { enqueueSignature } from '../queue/onLogsQueue.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { getCurrentConfig } from '../config/configLoader.js';
import { redisPublishLog } from '../utils/redisLogSender.js';
import { updateLastSignature } from '../db/subscriptions.js';
import { enqueueRedisRetry } from '../queue/redisRetryQueue.js';

const SERVICE_NAME = 'solana_subscriber';

export async function handleLogEvent({ chain_id, account, signature, subscription_type, rpc }) {
  const config = getCurrentConfig();

  const allowedTypes = new Set(['regular', 'control', 'mint', 'share', 'spl_token']);
  if (!allowedTypes.has(subscription_type)) return;

  if (!rpc.limiter.removeToken()) {
    enqueueSignature(signature);
    await sharedLogger({
      service: SERVICE_NAME,
      level: 'warn',
      message: {
        event: 'rate_limit',
        signature,
        rpc_id: rpc.id,
        chain_id,
        account,
      },
    });
    return;
  }

  const parsed = await getParsedTransactionWithTimeout(rpc, signature);
  if (!parsed) {
    await scheduleRetry(signature);
    return;
  }

  if (parsed.meta?.err) {
    await sharedLogger({
      service: SERVICE_NAME,
      level: 'warn',
      message: {
        type: 'failed_transaction',
        signature,
        error: parsed.meta.err,
      },
    });
    return;
  }

  const blockTime = parsed.blockTime || null;
  const timestamp = blockTime ? blockTime * 1000 : Date.now();

  const message = {
    chain_id,
    account,
    signature,
    log: parsed,
    subscription_type,
    blockTime,
    timestamp,
  };

  const streamKey = subscription_type === 'spl_token' ? 'solana_logs_spl' : 'solana_logs_regular';

  try {
    await redisPublishLog(streamKey, message);
    await updateLastSignature(chain_id, account, signature);

    await sharedLogger({
      service: SERVICE_NAME,
      level: 'info',
      message: {
        type: 'transaction_dispatched',
        stream: streamKey,
        signature,
        chain_id,
        rpc_id: rpc.id,
      },
    });
  } catch (err) {
    enqueueRedisRetry({ streamKey, message });

    await sharedLogger({
      service: SERVICE_NAME,
      level: 'error',
      message: {
        type: 'redis_publish_failed',
        signature,
        error: err.message,
      },
    });
  }
}
