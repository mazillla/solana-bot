import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as queue from '@/services/solana_subscriber/queue/onLogsQueue.js';
import * as sharedLogger from '@/utils/sharedLogger.js';

describe('S23: Очередь переполнена', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sharedLogger, 'sharedLogger').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('не добавляет сигнатуру и логирует overflow, если очередь переполнена', () => {
    // Наполняем очередь до лимита
    for (let i = 0; i < 1000; i++) {
      queue.enqueueSignature(`sig-${i}`);
    }

    // Попробуем добавить лишнюю
    queue.enqueueSignature('sig-overflow');

    const currentLength = queue.getQueueLength();
    expect(currentLength).toBe(1000); // всё ещё 1000, новая не добавлена

    expect(sharedLogger.sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warn',
        message: expect.objectContaining({
          event: 'queue_overflow',
          type: 'rate_limit',
          signature: 'sig-overflow',
        }),
      })
    );
  });
});
