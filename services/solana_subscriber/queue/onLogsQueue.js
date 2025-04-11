import { sharedLogger } from '../../../utils/sharedLogger.js';

const SERVICE_NAME = 'solana_subscriber';
const MAX_QUEUE_LENGTH = 1000;

const queue = [];

export function enqueueSignature(signature) {
  if (queue.length >= MAX_QUEUE_LENGTH) {
    sharedLogger({
      service: SERVICE_NAME,
      level: 'warn',
      message: {
        event: 'queue_overflow',
        type: 'rate_limit',
        signature,
      },
    });
    return;
  }
  queue.push(signature);
}

export function dequeueSignature() {
  return queue.shift();
}

export function getQueueLength() {
  return queue.length;
}

export async function processQueue(handler) {
  if (queue.length === 0) return;

  sharedLogger({
    service: SERVICE_NAME,
    level: 'info',
    message: {
      event: 'queue_resumed',
      queue_length: queue.length,
    },
  });

  while (queue.length > 0) {
    const signature = dequeueSignature();
    await handler(signature);
  }
}
