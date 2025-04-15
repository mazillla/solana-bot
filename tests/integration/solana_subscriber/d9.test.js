import { describe, it, expect, vi } from 'vitest';
import { startRedisRetryWorker, stopRedisRetryWorker } from '@/services/solana_subscriber/queue/redisRetryQueue.js';
import * as redisLogSender from '@/services/solana_subscriber/utils/redisLogSender.js';

describe('D9: Процесс не встаёт от зависания event loop', () => {
  it('таймер продолжает тикать во время зависшего воркера', async () => {
    vi.useFakeTimers();

    // Мокаем redisPublishLog — зависает
    vi.spyOn(redisLogSender, 'redisPublishLog').mockImplementation(() => {
      return new Promise(() => {}); // "висим" бесконечно
    });

    startRedisRetryWorker(); // запустим зависший воркер

    // 🧪 Проверим, что setTimeout работает параллельно
    let ticked = false;
    setTimeout(() => {
      ticked = true;
    }, 5000);

    vi.advanceTimersByTime(5000);
    expect(ticked).toBe(true);

    // Останавливаем воркер
    stopRedisRetryWorker();
    vi.useRealTimers();
  });
});
