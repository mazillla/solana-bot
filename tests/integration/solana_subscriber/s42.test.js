import { describe, it, expect, vi } from 'vitest';
import { withAbortTimeout } from '@/utils/withAbortTimeout.js';

describe('S42: AbortController корректно прерывает withAbortTimeout', () => {
  it('прерывает выполнение после таймаута', async () => {
    const longTask = async (signal) => {
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('Aborted')));
        setTimeout(() => resolve('✅ Done'), 5000); // Заведомо дольше таймаута
      });
    };

    const start = Date.now();

    let error;
    try {
      await withAbortTimeout(longTask, 100); // таймаут — 100 мс
    } catch (err) {
      error = err;
    }

    const elapsed = Date.now() - start;

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Aborted');
    expect(elapsed).toBeLessThan(500); // подтверждаем, что оборвало быстро
  });

  it('успешно завершает задачу, если она укладывается в таймаут', async () => {
    const quickTask = async (signal) => {
      return new Promise((resolve) => {
        signal.addEventListener('abort', () => {});
        setTimeout(() => resolve('✅ Quick'), 50);
      });
    };

    const result = await withAbortTimeout(quickTask, 1000);

    expect(result).toBe('✅ Quick');
  });
});
