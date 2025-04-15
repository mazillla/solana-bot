// tests/integration/solana_subscriber/i17.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('i17 — retryQueue удаляет лог после успеха и не повторяет', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('не отправляет повторно успешно доставленный лог', async () => {
    const sharedLogger = vi.fn();
    const updateLastSignature = vi.fn().mockResolvedValue();
    const redisPublishLog = vi.fn().mockResolvedValue();

    const message = {
      chain_id: 'c5',
      account: 'AccOne',
      signature: 'sig-unique-1',
      log: { meta: { err: null } },
      subscription_type: 'regular',
      blockTime: 1710000000,
      timestamp: 1710000000000,
    };

    vi.doMock('@/utils/sharedLogger.js', () => ({ sharedLogger }));
    vi.doMock('@/services/solana_subscriber/utils/redisLogSender.js', () => ({ redisPublishLog }));
    vi.doMock('@/services/solana_subscriber/db/subscriptions.js', () => ({ updateLastSignature }));

    const {
      enqueueRedisRetry,
      startRedisRetryWorker,
      stopRedisRetryWorker,
    } = await import('@/services/solana_subscriber/queue/redisRetryQueue.js');

    // enqueue + запуск
    await enqueueRedisRetry({ streamKey: 'solana_logs_regular', message });

    startRedisRetryWorker();

    await new Promise((r) => setTimeout(r, 2500));

    stopRedisRetryWorker();

    // ✅ должен быть только один вызов redisPublishLog
    expect(redisPublishLog).toHaveBeenCalledTimes(1);

    // ✅ не должно быть повторной попытки
    expect(sharedLogger).not.toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          type: 'redis_retry_failed',
        }),
      })
    );

    // ✅ успешная отправка зафиксирована
    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          type: 'redis_retry_success',
          signature: 'sig-unique-1',
        }),
      })
    );
  }, 10000);
});
