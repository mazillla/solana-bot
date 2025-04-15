import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as retryQueue from '@/services/solana_subscriber/queue/redisRetryQueue.js';
import * as redisSender from '@/services/solana_subscriber/utils/redisLogSender.js';
import * as subscriptions from '@/services/solana_subscriber/db/subscriptions.js';
import * as sharedLogger from '@/utils/sharedLogger.js';

describe('S33: retryQueue повторно отправляет лог', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();

    vi.spyOn(redisSender, 'redisPublishLog').mockResolvedValue();
    vi.spyOn(subscriptions, 'updateLastSignature').mockResolvedValue();
    vi.spyOn(sharedLogger, 'sharedLogger').mockResolvedValue();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('успешно повторно отправляет лог и обновляет сигнатуру', async () => {
    const message = {
      chain_id: 'retry-chain',
      account: 'retry-acc',
      signature: 'retry-sig',
      log: {},
      subscription_type: 'regular',
      timestamp: Date.now(),
    };

    retryQueue.enqueueRedisRetry({
      streamKey: 'solana_logs_regular',
      message,
    });

    retryQueue.startRedisRetryWorker();

    // Подвигаем таймеры, чтобы обработка прошла
    await vi.advanceTimersByTimeAsync(1100);

    expect(redisSender.redisPublishLog).toHaveBeenCalledWith('solana_logs_regular', message);
    expect(subscriptions.updateLastSignature).toHaveBeenCalledWith('retry-chain', 'retry-acc', 'retry-sig');

    expect(sharedLogger.sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'info',
        message: expect.objectContaining({
          type: 'redis_retry_success',
          signature: 'retry-sig',
        }),
      })
    );

    retryQueue.stopRedisRetryWorker(); // Чистим за собой
  });
});
