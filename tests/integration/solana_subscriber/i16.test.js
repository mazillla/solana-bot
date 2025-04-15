// tests/integration/solana_subscriber/i16.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('i16 — Redis недоступен 15+ минут → retryQueue продолжает попытки', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('повторно пытается отправить лог после восстановления Redis', async () => {
    const sharedLogger = vi.fn();
    const updateLastSignature = vi.fn();

    const message = {
      chain_id: 'c1',
      account: 'AccRetry',
      signature: 'sigRetry123',
      log: { meta: { err: null } },
      subscription_type: 'regular',
      blockTime: 1710000000,
      timestamp: 1710000000000,
    };

    // Первая попытка — ошибка, вторая — успех
    const redisPublishLog = vi
      .fn()
      .mockRejectedValueOnce(new Error('Redis down'))
      .mockResolvedValueOnce();

    vi.doMock('@/utils/sharedLogger.js', () => ({ sharedLogger }));
    vi.doMock('@/services/solana_subscriber/utils/redisLogSender.js', () => ({ redisPublishLog }));
    vi.doMock('@/services/solana_subscriber/db/subscriptions.js', () => ({ updateLastSignature }));

    const {
      enqueueRedisRetry,
      startRedisRetryWorker,
      stopRedisRetryWorker,
    } = await import('@/services/solana_subscriber/queue/redisRetryQueue.js');

    await enqueueRedisRetry({ streamKey: 'solana_logs_regular', message });

    // Стартуем retry-воркер в фоне
    startRedisRetryWorker();

    // Ждём 3–4 секунды на 2 попытки
    await new Promise((r) => setTimeout(r, 4000));

    stopRedisRetryWorker();

    // ✅ Первая попытка — ошибка
    expect(redisPublishLog.mock.calls[0][1]).toMatchObject({ signature: 'sigRetry123' });

    // ✅ Вторая — успешная
    expect(redisPublishLog.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(updateLastSignature).toHaveBeenCalledWith('c1', 'AccRetry', 'sigRetry123');

    // ✅ Лог: успех
    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          type: 'redis_retry_success',
          signature: 'sigRetry123',
        }),
      })
    );
  }, 10000); // ⏳ увеличиваем таймаут на 10 сек
});
