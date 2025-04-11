import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../services/solana_subscriber/utils/redisLogSender.js', () => ({
  redisPublishLog: vi.fn(),
}));

vi.mock('../services/solana_subscriber/db/subscriptions.js', () => ({
  updateLastSignature: vi.fn(),
}));

vi.mock('../utils/sharedLogger.js', () => ({
  sharedLogger: vi.fn(),
}));

import { redisPublishLog } from '../services/solana_subscriber/utils/redisLogSender.js';
import { updateLastSignature } from '../services/solana_subscriber/db/subscriptions.js';
import { sharedLogger } from '../utils/sharedLogger.js';

import {
  enqueueRedisRetry,
  startRedisRetryWorker,
  stopRedisRetryWorker,
} from '../services/solana_subscriber/queue/redisRetryQueue.js';

describe('redisRetryQueue', () => {
  const message = {
    chain_id: 'chain1',
    account: 'acc123',
    signature: 'sigABC',
  };
  const streamKey = 'solana_logs_regular';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    stopRedisRetryWorker(); // Останавливаем воркер после каждого теста
  });

  it('enqueueRedisRetry добавляет элемент в очередь и успешно обрабатывает', async () => {
    redisPublishLog.mockResolvedValue();
    updateLastSignature.mockResolvedValue();

    enqueueRedisRetry({ streamKey, message });
    startRedisRetryWorker();

    await new Promise((res) => setTimeout(res, 1500)); // подождаться обработки

    expect(redisPublishLog).toHaveBeenCalledWith(streamKey, message);
    expect(updateLastSignature).toHaveBeenCalledWith(
      message.chain_id,
      message.account,
      message.signature
    );
    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'info',
        message: expect.objectContaining({
          type: 'redis_retry_success',
        }),
      })
    );
  });

  it(
    'если publish падает — повторная попытка до 5 раз, затем лог ошибки',
    async () => {
      redisPublishLog.mockRejectedValue(new Error('Redis unavailable'));

      enqueueRedisRetry({ streamKey, message });
      startRedisRetryWorker();

      await new Promise((res) => setTimeout(res, 7000)); // ждём повторы (6 попыток)

      expect(redisPublishLog).toHaveBeenCalledTimes(6); // 1 оригинальная + 5 повторов
      expect(sharedLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'error',
          message: expect.objectContaining({
            type: 'redis_retry_failed',
            signature: message.signature,
            error: 'Redis unavailable',
          }),
        })
      );
    },
    10000 // ⬅ таймаут теста увеличен до 10 секунд
  );
});
