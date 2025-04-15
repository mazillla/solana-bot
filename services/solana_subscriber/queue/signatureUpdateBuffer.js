// services/solana_subscriber/queue/signatureUpdateBuffer.js
import { updateLastSignature } from '../db/subscriptions.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { sleep } from '../../../utils/sleep.js';

const SERVICE_NAME = 'solana_subscriber_signatureBuffer';

const bufferMap = new Map(); // key: chain_id:account → signature
let isRunning = false;

export function setPendingUpdate(chain_id, account, signature) {
  const key = `${chain_id}:${account}`;
  bufferMap.set(key, signature);

  if (!isRunning) {
    startSignatureUpdateWorker(); // автоматически запускаем
  }
}

export function startSignatureUpdateWorker() {
  if (isRunning) return;
  isRunning = true;
  loop();
}

async function loop() {
  while (isRunning) {
    const entries = Array.from(bufferMap.entries());

    if (entries.length === 0) {
      await sleep(1000);
      continue;
    }

    for (const [key, signature] of entries) {
      const [chain_id, account] = key.split(':');
      try {
        await updateLastSignature(chain_id, account, signature);
        bufferMap.delete(key);

        try {
          await sharedLogger({
            service: SERVICE_NAME,
            level: 'info',
            message: {
              type: 'signature_synced',
              chain_id,
              account,
              signature,
            },
          });
        } catch (_) {}
      } catch (err) {
        try {
          await sharedLogger({
            service: SERVICE_NAME,
            level: 'warn',
            message: {
              type: 'signature_sync_failed',
              chain_id,
              account,
              signature,
              error: err.message,
            },
          });
        } catch (_) {}
      }
    }

    await sleep(1000);
  }
}

