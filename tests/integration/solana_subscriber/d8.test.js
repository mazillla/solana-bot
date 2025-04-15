import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  enqueueSignature,
  dequeueSignature,
  getQueueLength,
} from '@/services/solana_subscriber/queue/onLogsQueue.js';
import * as sharedLogger from '@/utils/sharedLogger.js';

describe('D8: Очередь переполнена → лог сохраняется', () => {
  beforeEach(() => {
    // очищаем очередь и внутренние структуры
    while (dequeueSignature()) {}
  });

  it('не добавляет лог при переполнении и пишет предупреждение', async () => {
    const warnSpy = vi.spyOn(sharedLogger, 'sharedLogger').mockResolvedValue();

    // Заполняем очередь до лимита
    for (let i = 0; i < 1000; i++) {
      enqueueSignature(`sig-${i}`);
    }

    // Пытаемся добавить 1001-ю
    enqueueSignature('sig-overflow');

    expect(getQueueLength()).toBe(1000); // не должно быть больше

    // Проверка, что sharedLogger вызвался с queue_overflow
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'solana_subscriber',
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
