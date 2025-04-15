import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startRedisRetryWorker, stopRedisRetryWorker, enqueueRedisRetry } from '@/services/solana_subscriber/queue/redisRetryQueue.js';
import * as redisSender from '@/services/solana_subscriber/utils/redisLogSender.js';
import * as subscriptions from '@/services/solana_subscriber/db/subscriptions.js';
import * as sharedLogger from '@/utils/sharedLogger.js';

describe('D2: Redis недоступен при retry — лог не теряется', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();

    vi.spyOn(sharedLogger, 'sharedLogger').mockResolvedValue();
    vi.spyOn(subscriptions, 'updateLastSignature').mockResolvedValue();
  });

  afterEach(() => {
    stopRedisRetryWorker();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('при повторной ошибке redisPublishLog лог остаётся в очереди', async () => {
    const redisPublishLog = vi.fn()
      .mockRejectedValueOnce(new Error('Redis still down'))   // первый раз — ошибка
      .mockResolvedValueOnce('OK');                            // второй раз — успех

    vi.spyOn(redisSender, 'redisPublishLog').mockImplementation(redisPublishLog);

    const message = {
      chain_id: 'chain-redis',
      account: 'account-redis',
      signature: 'sig-retry-d2',
      log: {},
      subscription_type: 'regular',
      timestamp: Date.now(),
    };

    enqueueRedisRetry({ streamKey: 'solana_logs_regular', message });

    startRedisRetryWorker();

    await vi.advanceTimersByTimeAsync(2000); // первый цикл
    await vi.advanceTimersByTimeAsync(2000); // второй цикл

    expect(redisPublishLog).toHaveBeenCalledTimes(2);
  });
});
