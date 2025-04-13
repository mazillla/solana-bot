import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/sharedLogger.js', () => ({
  sharedLogger: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/config/configLoader.js', () => ({
  loadSubscriberConfig: vi.fn(() => { throw new Error('boom'); }),
}));

const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
process.on('unhandledRejection', () => {}); // подавляем crash

describe('solana_subscriber/start.js error path', () => {
  it('должна логировать ошибку и завершать процесс при сбое start()', async () => {
    const { sharedLogger } = await import('@/utils/sharedLogger.js');
    const { start } = await import('@/services/solana_subscriber/start.js');

    await start();

    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        message: expect.stringContaining('Ошибка при инициализации'),
      })
    );

    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
