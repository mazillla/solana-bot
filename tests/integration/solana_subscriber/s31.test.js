import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleLogEvent } from '@/services/solana_subscriber/subscription/onLogsHandler.js';
import * as rpcUtils from '@/services/solana_subscriber/rpc/rpcUtils.js';
import * as redisSender from '@/services/solana_subscriber/utils/redisLogSender.js';
import * as subscriptions from '@/services/solana_subscriber/db/subscriptions.js';
import * as retryQueue from '@/services/solana_subscriber/queue/redisRetryQueue.js';
import * as sharedLogger from '@/utils/sharedLogger.js';
import { getCurrentConfig } from '@/services/solana_subscriber/config/configLoader.js';

vi.mock('@/services/solana_subscriber/config/configLoader.js', () => ({
  getCurrentConfig: vi.fn(() => ({ rpc_timeout_ms: 5000 })),
}));

describe('S31: Redis недоступен — лог попадает в retryQueue', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(rpcUtils, 'getParsedTransactionWithTimeout').mockResolvedValue({
      meta: null,
      blockTime: 1234567890,
    });

    vi.spyOn(redisSender, 'redisPublishLog').mockRejectedValue(new Error('Redis down'));
    vi.spyOn(subscriptions, 'updateLastSignature').mockResolvedValue();
    vi.spyOn(retryQueue, 'enqueueRedisRetry').mockImplementation(() => {});
    vi.spyOn(sharedLogger, 'sharedLogger').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('добавляет лог в retryQueue при ошибке Redis', async () => {
    const rpc = {
      id: 'rpc-redis',
      limiter: { removeToken: () => true },
    };

    await handleLogEvent({
      chain_id: 'chain-r',
      account: 'acc-r',
      signature: 'sig-r',
      subscription_type: 'regular',
      rpc,
    });

    expect(redisSender.redisPublishLog).toHaveBeenCalled();
    expect(retryQueue.enqueueRedisRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        streamKey: 'solana_logs_regular',
        message: expect.objectContaining({
          signature: 'sig-r',
        }),
      })
    );

    expect(sharedLogger.sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        message: expect.objectContaining({
          type: 'redis_publish_failed',
          signature: 'sig-r',
          error: 'Redis down',
        }),
      })
    );
  });
});
