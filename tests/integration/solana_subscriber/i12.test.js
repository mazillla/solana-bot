// tests/integration/solana_subscriber/i12.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('i12 — восстановление подписок и last_signature после рестарта', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('восстанавливает все подписки из БД через getActiveSubscriptions → subscribeToAccount', async () => {
    const sharedLogger = vi.fn();
    const initPostgres = vi.fn().mockResolvedValue();
    const closePostgres = vi.fn().mockResolvedValue();
    const loadSubscriberConfig = vi.fn().mockResolvedValue({
      rpc_endpoints: [],
    });
    const initRpcPool = vi.fn().mockResolvedValue();

    const fakeSubs = [
      { chain_id: 'c1', account: 'A1', subscription_type: 'mint' },
      { chain_id: 'c2', account: 'A2', subscription_type: 'regular' },
    ];

    const getActiveSubscriptions = vi.fn().mockResolvedValue(fakeSubs);
    const startAllSubscriptions = vi.fn().mockResolvedValue();

    const startRedisConsumer = vi.fn();
    const startOnLogsQueueWorker = vi.fn();
    const startRedisRetryWorker = vi.fn();

    // Мокаем всё до вызова start()
    vi.doMock('@/utils/sharedLogger.js', () => ({ sharedLogger }));
    vi.doMock('@/services/solana_subscriber/db/db.js', () => ({
      initPostgres,
      closePostgres,
    }));
    vi.doMock('@/services/solana_subscriber/config/configLoader.js', () => ({
      loadSubscriberConfig,
    }));
    vi.doMock('@/services/solana_subscriber/rpc/rpcPool.js', () => ({
      initRpcPool,
    }));
    vi.doMock('@/services/solana_subscriber/db/subscriptions.js', () => ({
      getActiveSubscriptions,
    }));
    vi.doMock('@/services/solana_subscriber/subscription/subscriptionManager.js', () => ({
      startAllSubscriptions,
    }));
    vi.doMock('@/services/solana_subscriber/queue/onLogsQueueWorker.js', () => ({
      startOnLogsQueueWorker,
    }));
    vi.doMock('@/services/solana_subscriber/queue/redisRetryQueue.js', () => ({
      startRedisRetryWorker,
    }));
    vi.doMock('@/services/solana_subscriber/config/redisConsumer.js', () => ({
      startRedisConsumer,
    }));

    const { start } = await import('@/services/solana_subscriber/start.js');

    await start();

    expect(initPostgres).toHaveBeenCalled();
    expect(loadSubscriberConfig).toHaveBeenCalled();
    expect(initRpcPool).toHaveBeenCalled();
    expect(getActiveSubscriptions).toHaveBeenCalled();
    expect(startAllSubscriptions).toHaveBeenCalledWith(fakeSubs);

    // Можно проверить запуск воркеров
    expect(startRedisConsumer).toHaveBeenCalled();
    expect(startOnLogsQueueWorker).toHaveBeenCalled();
    expect(startRedisRetryWorker).toHaveBeenCalled();
  });
});
