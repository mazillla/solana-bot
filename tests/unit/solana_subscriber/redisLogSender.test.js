vi.mock('redis', () => {
    const connect = vi.fn();
    const xAdd = vi.fn();
    const mockClient = { connect, xAdd };
    const createClient = vi.fn(() => mockClient);
  
    return { createClient };
  });
  
  import { describe, it, expect, vi, beforeEach } from 'vitest';
  
  let createClient;
  let mockClient;
  
  beforeEach(async () => {
    vi.resetModules(); // 🧼 очищает кэш модулей
    const redis = await import('redis');
    createClient = redis.createClient;
    mockClient = {
      connect: vi.fn(),
      xAdd: vi.fn(),
    };
    createClient.mockReturnValue(mockClient); // 🛠 мок возвращает нашего клиента
  });
  
  describe('redisPublishLog', () => {
    it('должна создать клиента, подключиться и отправить лог', async () => {
      const { redisPublishLog } = await import('@/services/solana_subscriber/utils/redisLogSender.js');
      const streamKey = 'logs';
      const message = { event: 'test', level: 'info' };
  
      await redisPublishLog(streamKey, message);
  
      expect(createClient).toHaveBeenCalledWith({ url: 'redis://redis:6379' });
      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockClient.xAdd).toHaveBeenCalledWith(streamKey, '*', {
        data: JSON.stringify(message),
      });
    });
  
    it('должна логировать ошибку при сбое Redis', async () => {
      mockClient.connect.mockRejectedValue(new Error('Connection failed'));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { redisPublishLog } = await import('@/services/solana_subscriber/utils/redisLogSender.js');
  
      await redisPublishLog('logs', { event: 'fail' });
  
      expect(consoleSpy).toHaveBeenCalledWith(
        '[redisPublishLog] Redis error:',
        'Connection failed'
      );
      consoleSpy.mockRestore();
    });
  });
  