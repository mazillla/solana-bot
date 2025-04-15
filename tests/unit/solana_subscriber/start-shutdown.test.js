import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/sharedLogger.js', () => ({
  sharedLogger: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/config/redisConsumer.js', () => ({
  stopRedisConsumer: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/queue/onLogsQueueWorker.js', () => ({
  stopOnLogsQueueWorker: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/queue/redisRetryQueue.js', () => ({
  stopRedisRetryWorker: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/subscription/subscriptionManager.js', () => ({
  stopAllSubscriptions: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/rpc/rpcPool.js', () => ({
  closeRpcPool: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/db/db.js', () => ({
  closePostgres: vi.fn(),
}));

describe('start.js shutdown()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('вызывает все stop/close функции и логирует завершение', async () => {
    const {
      stopRedisConsumer,
    } = await import('@/services/solana_subscriber/config/redisConsumer.js');
    const {
      stopOnLogsQueueWorker,
    } = await import('@/services/solana_subscriber/queue/onLogsQueueWorker.js');
    const {
      stopRedisRetryWorker,
    } = await import('@/services/solana_subscriber/queue/redisRetryQueue.js');
    const {
      stopAllSubscriptions,
    } = await import('@/services/solana_subscriber/subscription/subscriptionManager.js');
    const { closeRpcPool } = await import('@/services/solana_subscriber/rpc/rpcPool.js');
    const { closePostgres } = await import('@/services/solana_subscriber/db/db.js');
    const { sharedLogger } = await import('@/utils/sharedLogger.js');

    const { shutdown } = await import('@/services/solana_subscriber/start.js');

    // 🧪 не вызываем process.exit внутри теста
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit prevented in test');
    });

    try {
      await shutdown();
    } catch (e) {
      // Ожидаемое поведение
    }

    expect(stopRedisConsumer).toHaveBeenCalled();
    expect(stopOnLogsQueueWorker).toHaveBeenCalled();
    expect(stopRedisRetryWorker).toHaveBeenCalled();
    expect(stopAllSubscriptions).toHaveBeenCalled();
    expect(closeRpcPool).toHaveBeenCalled();
    expect(closePostgres).toHaveBeenCalled();

    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '✅ Завершено корректно',
      })
    );

    mockExit.mockRestore();
  });
});
