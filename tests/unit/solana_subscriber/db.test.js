// tests/unit/db.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Мокаем 'pg' до импорта тестируемого модуля
vi.mock('pg', () => {
  const connect = vi.fn();
  const end = vi.fn();

  const mockPool = { connect, end };
  const Pool = vi.fn(() => mockPool);

  globalThis.__mockPoolInstance__ = mockPool;
  globalThis.__mockPoolConstructor__ = Pool;

  return {
    __esModule: true,
    default: { Pool },
    Pool,
  };
});

// Мокаем sharedLogger
vi.mock('@/utils/sharedLogger.js', () => ({
  sharedLogger: vi.fn(),
}));

describe('db.js', () => {
  let db;
  let sharedLogger;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    db = await import('@/services/solana_subscriber/db/db.js');
    sharedLogger = (await import('@/utils/sharedLogger.js')).sharedLogger;
  });

  it('должна подключиться к PostgreSQL и залогировать подключение', async () => {
    await db.initPostgres();

    expect(globalThis.__mockPoolInstance__.connect).toHaveBeenCalled();
    expect(sharedLogger).toHaveBeenCalledWith({
      service: 'solana_subscriber',
      level: 'info',
      message: {
        type: 'postgres_connected',
        message: 'Подключено к PostgreSQL',
      },
    });
  });

  it('должна закрыть соединение с PostgreSQL и залогировать отключение', async () => {
    await db.closePostgres();

    expect(globalThis.__mockPoolInstance__.end).toHaveBeenCalled();
    expect(sharedLogger).toHaveBeenCalledWith({
      service: 'solana_subscriber',
      level: 'info',
      message: {
        type: 'postgres_disconnected',
        message: 'Отключено от PostgreSQL',
      },
    });
  });

  it('должен создать объект pool', () => {
    expect(globalThis.__mockPoolConstructor__).toHaveBeenCalled();
    expect(db.pool).toHaveProperty('connect');
    expect(db.pool).toHaveProperty('end');
  });

  it('не должен упасть, если sharedLogger падает при initPostgres', async () => {
    sharedLogger.mockImplementationOnce(() => {
      throw new Error('логгер упал при подключении');
    });

    await expect(db.initPostgres()).resolves.toBeUndefined();
    expect(globalThis.__mockPoolInstance__.connect).toHaveBeenCalled();
  });

  it('не должен упасть, если sharedLogger падает при closePostgres', async () => {
    sharedLogger.mockImplementationOnce(() => {
      throw new Error('логгер упал при отключении');
    });

    await expect(db.closePostgres()).resolves.toBeUndefined();
    expect(globalThis.__mockPoolInstance__.end).toHaveBeenCalled();
  });
});
