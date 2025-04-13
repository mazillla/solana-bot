import { describe, it, expect, vi, beforeEach } from 'vitest';

const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
process.on('unhandledRejection', () => {}); // подавляем crash

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

vi.mock('@/services/solana_subscriber/rpc/rpcPool.js', () => ({
  closeRpcPool: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/db/db.js', () => ({
  closePostgres: vi.fn(),
}));

describe('solana_subscriber/start.js shutdown()', () => {
  beforeEach(() => {
    vi.resetModules(); // сбрасывает модули и shuttingDown
    vi.clearAllMocks();
  });

  it('корректно завершает работу при shutdown()', async () => {
    // обычный мок без ошибки
    vi.doMock('@/services/solana_subscriber/subscription/subscriptionManager.js', () => ({
      stopAllSubscriptions: vi.fn(),
    }));

    const { sharedLogger } = await import('@/utils/sharedLogger.js');
    const { shutdown } = await import('@/services/solana_subscriber/start.js');

    await shutdown();

    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Завершение работы') })
    );
    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Завершено корректно') })
    );

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('логирует ошибку при сбое во время shutdown()', async () => {
    vi.doMock('@/services/solana_subscriber/subscription/subscriptionManager.js', () => ({
      stopAllSubscriptions: vi.fn(() => {
        throw new Error('test error');
      }),
    }));

    vi.resetModules(); // чтобы подгрузился мок

    const { sharedLogger } = await import('@/utils/sharedLogger.js');
    const { shutdown } = await import('@/services/solana_subscriber/start.js');

    await shutdown();

    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        message: expect.stringContaining('Ошибка при завершении'),
      })
    );

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('не выполняет повторное завершение, если уже завершено', async () => {
    vi.doMock('@/services/solana_subscriber/subscription/subscriptionManager.js', () => ({
      stopAllSubscriptions: vi.fn(),
    }));

    const { sharedLogger } = await import('@/utils/sharedLogger.js');
    const { shutdown } = await import('@/services/solana_subscriber/start.js');

    await shutdown(); // первый раз — всё выполнится
    vi.clearAllMocks(); // очищаем вызовы

    await shutdown(); // второй раз — должно быть no-op

    expect(sharedLogger).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
