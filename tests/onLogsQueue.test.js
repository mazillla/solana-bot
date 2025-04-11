import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/sharedLogger.js', () => ({
  sharedLogger: vi.fn(),
}));

import {
  enqueueSignature,
  dequeueSignature,
  getQueueLength,
  processQueue,
} from '../services/solana_subscriber/queue/onLogsQueue.js';

import { sharedLogger } from '../utils/sharedLogger.js';

describe('onLogsQueue', () => {
  beforeEach(() => {
    // Очистим очередь перед каждым тестом
    while (dequeueSignature()) {}
    vi.clearAllMocks();
  });

  it('enqueue и dequeue работают в FIFO-режиме', () => {
    enqueueSignature('sig1');
    enqueueSignature('sig2');

    expect(getQueueLength()).toBe(2);
    expect(dequeueSignature()).toBe('sig1');
    expect(dequeueSignature()).toBe('sig2');
    expect(getQueueLength()).toBe(0);
  });

  it('enqueue превышает лимит — sharedLogger вызывается', () => {
    // Заполним очередь до лимита
    for (let i = 0; i < 1000; i++) {
      enqueueSignature(`sig-${i}`);
    }

    enqueueSignature('overflow-sig');

    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warn',
        message: expect.objectContaining({
          event: 'queue_overflow',
          signature: 'overflow-sig',
        }),
      })
    );
  });

  it('processQueue вызывает handler для всех элементов и очищает очередь', async () => {
    const handler = vi.fn();

    enqueueSignature('a');
    enqueueSignature('b');
    enqueueSignature('c');

    await processQueue(handler);

    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler).toHaveBeenNthCalledWith(1, 'a');
    expect(handler).toHaveBeenNthCalledWith(2, 'b');
    expect(handler).toHaveBeenNthCalledWith(3, 'c');
    expect(getQueueLength()).toBe(0);
  });

  it('processQueue не вызывает handler, если очередь пуста', async () => {
    const handler = vi.fn();

    await processQueue(handler);

    expect(handler).not.toHaveBeenCalled();
    expect(sharedLogger).not.toHaveBeenCalled();
  });

  it('processQueue логирует длину очереди при запуске', async () => {
    const handler = vi.fn();
    enqueueSignature('sig-x');

    await processQueue(handler);

    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'info',
        message: expect.objectContaining({
          event: 'queue_resumed',
          queue_length: 1,
        }),
      })
    );
  });
});
