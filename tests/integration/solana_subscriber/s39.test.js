import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  enqueueSignature,
  processQueue,
  getQueueLength,
} from '@/services/solana_subscriber/queue/onLogsQueue.js';
import * as sharedLogger from '@/utils/sharedLogger.js';

describe('S39: 1000+ логов/сек — не теряем', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sharedLogger, 'sharedLogger').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('обрабатывает 1000 записей без потерь', async () => {
    const processed = [];

    // Добавляем 1000 сигнатур
    for (let i = 0; i < 1000; i++) {
      enqueueSignature(`sig-${i}`);
    }

    // Обработчик будет сохранять сигнатуры
    const handler = async (signature) => {
      processed.push(signature.signature || signature);
    };

    expect(getQueueLength()).toBe(1000);

    await processQueue(handler);

    expect(getQueueLength()).toBe(0);
    expect(processed.length).toBe(1000);
    expect(processed[0]).toBe('sig-0');
    expect(processed[999]).toBe('sig-999');
  });
});
