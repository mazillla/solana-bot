import { sharedLogger } from '@/utils/sharedLogger.js';

const SERVICE_NAME = 'solana_subscriber';
const MAX_QUEUE_LENGTH = 1000;

const queue = [];
const queuedSet = new Set(); // 🆕 Храним уникальные сигнатуры для deduplication

export function enqueueSignature(signature) {
  if (queuedSet.has(signature)) return;

  if (queue.length >= MAX_QUEUE_LENGTH) {
    try {
      sharedLogger({
        service: SERVICE_NAME,
        level: 'warn',
        message: {
          event: 'queue_overflow',
          type: 'rate_limit',
          signature,
        },
      });
    } catch (_) {}
    return;
  }

  queue.push(signature);
  queuedSet.add(signature);
}

export function dequeueSignature() {
  const sig = queue.shift();
  if (sig) queuedSet.delete(sig);
  return sig;
}

export function getQueueLength() {
  return queue.length;
}

export async function processQueue(handler) {
  if (queue.length === 0) return;

  try {
    await sharedLogger({
      service: SERVICE_NAME,
      level: 'info',
      message: {
        event: 'queue_resumed',
        queue_length: queue.length,
      },
    });
  } catch (_) {}

  while (queue.length > 0) {
    const signature = dequeueSignature();
    await handler(signature);
  }
}
