import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/sharedLogger.js', () => ({
  sharedLogger: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/db/db.js', () => ({
  initPostgres: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/config/configLoader.js', () => ({
  loadSubscriberConfig: vi.fn().mockResolvedValue({
    rpc_endpoints: [{ http: 'https://rpc' }],
  }),
}));

vi.mock('@/services/solana_subscriber/rpc/rpcPool.js', () => ({
  initRpcPool: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/db/subscriptions.js', () => ({
  getActiveSubscriptions: vi.fn().mockResolvedValue([
    { chain_id: 'x', account: 'y', subscription_type: 'regular' },
  ]),
}));

vi.mock('@/services/solana_subscriber/subscription/subscriptionManager.js', () => ({
  startAllSubscriptions: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/config/redisConsumer.js', () => ({
  startRedisConsumer: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/queue/onLogsQueueWorker.js', () => ({
  startOnLogsQueueWorker: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/queue/redisRetryQueue.js', () => ({
  startRedisRetryWorker: vi.fn(),
}));

describe('start.js start()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('выполняет инициализацию и запускает компоненты', async () => {
    const { start } = await import('@/services/solana_subscriber/start.js');

    await start();

    const { sharedLogger } = await import('@/utils/sharedLogger.js');
    const { initPostgres } = await import('@/services/solana_subscriber/db/db.js');
    const { loadSubscriberConfig } = await import('@/services/solana_subscriber/config/configLoader.js');
    const { initRpcPool } = await import('@/services/solana_subscriber/rpc/rpcPool.js');
    const { getActiveSubscriptions } = await import('@/services/solana_subscriber/db/subscriptions.js');
    const { startAllSubscriptions } = await import('@/services/solana_subscriber/subscription/subscriptionManager.js');
    const { startRedisConsumer } = await import('@/services/solana_subscriber/config/redisConsumer.js');
    const { startOnLogsQueueWorker } = await import('@/services/solana_subscriber/queue/onLogsQueueWorker.js');
    const { startRedisRetryWorker } = await import('@/services/solana_subscriber/queue/redisRetryQueue.js');

    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '⚙ Инициализация микросервиса...',
      })
    );

    expect(initPostgres).toHaveBeenCalled();
    expect(loadSubscriberConfig).toHaveBeenCalled();
    expect(initRpcPool).toHaveBeenCalledWith(
      expect.arrayContaining([{ http: 'https://rpc' }])
    );

    expect(getActiveSubscriptions).toHaveBeenCalled();
    expect(startAllSubscriptions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ subscription_type: 'regular' }),
      ])
    );

    expect(startRedisConsumer).toHaveBeenCalled();
    expect(startOnLogsQueueWorker).toHaveBeenCalled();
    expect(startRedisRetryWorker).toHaveBeenCalled();

    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '🚀 solana_subscriber успешно запущен',
      })
    );
  });
});
