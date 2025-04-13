// Мокаем до любых импортов
vi.mock('pg', () => {
    const connect = vi.fn();
    const end = vi.fn();
  
    const mockPool = { connect, end };
    const Pool = vi.fn(() => mockPool);
  
    // Сохраняем Pool в globalThis для доступа из тестов
    globalThis.__mockPoolInstance__ = mockPool;
    globalThis.__mockPoolConstructor__ = Pool;
  
    return {
      __esModule: true,
      default: { Pool },
      Pool,
    };
  });
  
//   vi.mock('../../\1', () => ({
//     sharedLogger: vi.fn(),
//   }));
  
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  import { sharedLogger } from '@/utils/sharedLogger.js';
  
  describe('db.js', () => {
    let db;
  
    beforeEach(async () => {
      vi.clearAllMocks();
      vi.resetModules();
      db = await import('@/services/solana_subscriber/db/db.js'); // импортим ПОСЛЕ моков
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
  });
  