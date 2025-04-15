// tests/integration/solana_subscriber/i15.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('i15 — Redis упал → лог попадает в retryQueue и система не падает', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('обрабатывает Redis ошибку и отправляет в retryQueue', async () => {
    const sharedLogger = vi.fn();
    const redisPublishLog = vi.fn().mockRejectedValue(new Error('Redis connection lost'));
    const enqueueRedisRetry = vi.fn();
    const updateLastSignature = vi.fn();

    const getParsedTransactionWithTimeout = vi.fn().mockResolvedValue({
      blockTime: 1710000000,
      meta: { err: null },
    });

    const mockRpc = { id: 'rpc-redis-down', limiter: { removeToken: () => true } };

    vi.doMock('@/utils/sharedLogger.js', () => ({ sharedLogger }));
    vi.doMock('@/services/solana_subscriber/utils/redisLogSender.js', () => ({ redisPublishLog }));
    vi.doMock('@/services/solana_subscriber/queue/redisRetryQueue.js', () => ({ enqueueRedisRetry }));
    vi.doMock('@/services/solana_subscriber/db/subscriptions.js', () => ({ updateLastSignature }));
    vi.doMock('@/services/solana_subscriber/rpc/rpcUtils.js', () => ({ getParsedTransactionWithTimeout }));
    vi.doMock('@/services/solana_subscriber/config/configLoader.js', () => ({
      getCurrentConfig: () => ({
        rpc_timeout_ms: 5000,
      }),
    }));

    const { handleLogEvent } = await import('@/services/solana_subscriber/subscription/onLogsHandler.js');

    await handleLogEvent({
      chain_id: 'cX',
      account: 'AccX',
      signature: 'sig-failed',
      subscription_type: 'regular',
      rpc: mockRpc,
    });

    expect(redisPublishLog).toHaveBeenCalled();
    expect(enqueueRedisRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          signature: 'sig-failed',
        }),
      })
    );

    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          type: 'redis_publish_failed',
          signature: 'sig-failed',
        }),
      })
    );

    // ❗ важно: НЕ должна упасть ошибка
    // если тест завершился — система не упала
  });
});
