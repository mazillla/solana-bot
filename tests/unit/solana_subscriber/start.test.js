import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sharedLogger } from '@/utils/sharedLogger.js';
import { start } from '@/services/solana_subscriber/start.js';

vi.mock('@/services/solana_subscriber/db/db.js', () => ({
  initPostgres: vi.fn(),
  closePostgres: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/config/configLoader.js', () => ({
  loadSubscriberConfig: vi.fn(() => ({
    rpc_endpoints: ['http://mock'],
  })),
}));

vi.mock('@/services/solana_subscriber/rpc/rpcPool.js', () => ({
  initRpcPool: vi.fn(),
  closeRpcPool: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/db/subscriptions.js', () => ({
  getActiveSubscriptions: vi.fn(() => []),
}));

vi.mock('@/services/solana_subscriber/config/redisConsumer.js', () => ({
  startRedisConsumer: vi.fn(),
  stopRedisConsumer: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/subscription/subscriptionManager.js', () => ({
  startAllSubscriptions: vi.fn(),
  stopAllSubscriptions: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/queue/onLogsQueueWorker.js', () => ({
  startOnLogsQueueWorker: vi.fn(),
  stopOnLogsQueueWorker: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/queue/redisRetryQueue.js', () => ({
  startRedisRetryWorker: vi.fn(),
  stopRedisRetryWorker: vi.fn(),
}));

vi.mock('@/utils/sharedLogger.js', () => ({
  sharedLogger: vi.fn(),
}));

describe('solana_subscriber/start.js init()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('должна вызвать sharedLogger для всех этапов запуска', async () => {
    await start();

    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Конфигурация загружена') })
    );

    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Найдено 0 активных подписок') })
    );

    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('успешно запущен') })
    );
  });
});
