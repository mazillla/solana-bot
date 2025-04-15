import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as queue from '@/services/solana_subscriber/queue/onLogsQueue.js';

describe('S25: Очередь работает по принципу FIFO', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('сохраняет порядок добавления сигнатур (FIFO)', () => {
    const signatures = ['sig1', 'sig2', 'sig3'];

    for (const sig of signatures) {
      queue.enqueueSignature(sig);
    }

    const dequeued1 = queue.dequeueSignature();
    const dequeued2 = queue.dequeueSignature();
    const dequeued3 = queue.dequeueSignature();

    expect(dequeued1).toBe('sig1');
    expect(dequeued2).toBe('sig2');
    expect(dequeued3).toBe('sig3');

    // Очередь должна быть пуста
    expect(queue.getQueueLength()).toBe(0);
  });
});
