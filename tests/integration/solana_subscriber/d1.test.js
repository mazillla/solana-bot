import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleLogEvent } from '@/services/solana_subscriber/subscription/onLogsHandler.js';
import { startRedisRetryWorker, stopRedisRetryWorker } from '@/services/solana_subscriber/queue/redisRetryQueue.js';
import * as rpcUtils from '@/services/solana_subscriber/rpc/rpcUtils.js';
import * as redisSender from '@/services/solana_subscriber/utils/redisLogSender.js';
import * as subscriptions from '@/services/solana_subscriber/db/subscriptions.js';
import * as sharedLogger from '@/utils/sharedLogger.js';

vi.mock('@/services/solana_subscriber/config/configLoader.js', () => ({
  getCurrentConfig: () => ({ rpc_timeout_ms: 5000 }),
}));

describe('D1: Redis недоступен 10 мин → логи не теряются и восстанавливаются', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers(); // ускорим время

    vi.spyOn(sharedLogger, 'sharedLogger').mockResolvedValue();

    vi.spyOn(rpcUtils, 'getParsedTransactionWithTimeout').mockResolvedValue({
      meta: null,
      blockTime: 1234567890,
    });

    vi.spyOn(subscriptions, 'updateLastSignature').mockResolvedValue();
  });

  afterEach(() => {
    vi.useRealTimers();
    stopRedisRetryWorker();
    vi.restoreAllMocks();
  });

  it('enqueue → успешная отправка после восстановления Redis', async () => {
    const redisPublishLog = vi.fn()
      .mockRejectedValueOnce(new Error('Redis is down')) // первая попытка — ошибка
      .mockResolvedValueOnce('✅ отправлено');           // вторая — успех

    vi.spyOn(redisSender, 'redisPublishLog').mockImplementation(redisPublishLog);

    const rpc = {
      id: 'rpc-x',
      limiter: { removeToken: () => true },
    };

    await handleLogEvent({
      chain_id: 'chainX',
      account: 'accX',
      signature: 'sigX',
      subscription_type: 'regular',
      rpc,
    });

    // запустим воркер, как будто Redis восстановился
    startRedisRetryWorker();

    await vi.advanceTimersByTimeAsync(2000); // ускорим время
    await vi.advanceTimersByTimeAsync(2000);

    expect(redisPublishLog).toHaveBeenCalledTimes(2); // 1 fail + 1 success
  });
});
