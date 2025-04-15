import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as queue from '@/services/solana_subscriber/queue/onLogsQueue.js';
import * as sharedLogger from '@/utils/sharedLogger.js';

describe('S24: Очередь пуста', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sharedLogger, 'sharedLogger').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('не вызывает обработчик, если очередь пуста', async () => {
    // Убедимся, что очередь пуста
    expect(queue.getQueueLength()).toBe(0);

    const handler = vi.fn();
    await queue.processQueue(handler);

    // Обработчик не должен быть вызван
    expect(handler).not.toHaveBeenCalled();

    // sharedLogger также не должен быть вызван
    expect(sharedLogger.sharedLogger).not.toHaveBeenCalled();
  });
});
