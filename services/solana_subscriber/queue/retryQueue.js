import { sharedLogger } from '../../../utils/sharedLogger.js';
import { getAvailableRpc } from '../rpc/rpcPool.js';
import { getParsedTransactionWithTimeout } from '../rpc/rpcUtils.js';
import { redisPublishLog } from '../utils/redisLogSender.js';
import { updateLastSignature } from '../db/subscriptions.js';

const SERVICE_NAME = 'solana_subscriber';
const retriesMap = new Map();

export async function scheduleRetry(signature) {
  const retries = retriesMap.get(signature) || 0;

  if (retries >= 3) {
    await sharedLogger({
      service: SERVICE_NAME,
      level: 'error',
      message: {
        type: 'unresolved_transaction',
        signature,
      },
    });
    retriesMap.delete(signature);
    return;
  }

  retriesMap.set(signature, retries + 1);
  const delay = 1000 * Math.pow(2, retries);

  await sharedLogger({
    service: SERVICE_NAME,
    level: 'debug',
    message: {
      type: 'retry_scheduled',
      signature,
      attempt: retries + 1,
      delay,
    },
  });

  setTimeout(() => {
    tryAgain(signature).catch((err) =>
      sharedLogger({
        service: SERVICE_NAME,
        level: 'error',
        message: {
          type: 'retry_unhandled_error',
          signature,
          error: err.message,
        },
      })
    );
  }, delay);
}

async function tryAgain(signature) {
  await sharedLogger({
    service: SERVICE_NAME,
    level: 'debug',
    message: {
      type: 'try_again',
      signature,
    },
  });

  const rpc = await getAvailableRpc();
  if (!rpc) {
    await sharedLogger({
      service: SERVICE_NAME,
      level: 'debug',
      message: {
        type: 'no_available_rpc',
        signature,
      },
    });
    await scheduleRetry(signature);
    return;
  }

  const parsed = await getParsedTransactionWithTimeout(rpc, signature);
  if (!parsed || parsed.meta?.err) {
    await sharedLogger({
      service: SERVICE_NAME,
      level: 'debug',
      message: {
        type: 'parse_fail',
        signature,
      },
    });
    await scheduleRetry(signature);
    return;
  }

  const blockTime = parsed.blockTime || null;
  const timestamp = blockTime ? blockTime * 1000 : Date.now();

  const message = {
    chain_id: 'unknown',
    account: 'unknown',
    signature,
    log: parsed,
    subscription_type: 'regular',
    blockTime,
    timestamp,
  };

  try {
    await redisPublishLog('solana_logs_regular', message);
    await updateLastSignature('unknown', 'unknown', signature);

    await sharedLogger({
      service: SERVICE_NAME,
      level: 'info',
      message: {
        type: 'retried_transaction_success',
        signature,
      },
    });

    retriesMap.delete(signature);
  } catch (err) {
    await sharedLogger({
      service: SERVICE_NAME,
      level: 'error',
      message: {
        type: 'logging_error',
        signature,
        error: err.message,
      },
    });
    await scheduleRetry(signature);
  }
}

export const __testOnlyTryAgain = tryAgain;
