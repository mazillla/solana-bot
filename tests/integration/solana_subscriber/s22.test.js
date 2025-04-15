import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { __processOneQueueItem } from '@/services/solana_subscriber/queue/onLogsQueueWorker.js';
import * as queue from '@/services/solana_subscriber/queue/onLogsQueue.js';
import * as rpcPool from '@/services/solana_subscriber/rpc/rpcPool.js';
import * as rpcUtils from '@/services/solana_subscriber/rpc/rpcUtils.js';
import * as redisSender from '@/services/solana_subscriber/utils/redisLogSender.js';
import * as subscriptions from '@/services/solana_subscriber/db/subscriptions.js';
import * as retryQueue from '@/services/solana_subscriber/queue/retryQueue.js';
import * as sharedLogger from '@/utils/sharedLogger.js';

describe('S22: Ошибка → лог попадает в retryQueue', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(rpcPool, 'getAvailableRpc').mockResolvedValue({ id: 'rpc-X', httpConn: {}, wsConn: {} });

    vi.spyOn(rpcUtils, 'getParsedTransactionWithTimeout').mockResolvedValue({
      meta: null,
      blockTime: 1234567890,
    });

    vi.spyOn(redisSender, 'redisPublishLog').mockRejectedValue(new Error('Redis broken'));

    vi.spyOn(subscriptions, 'updateLastSignature').mockResolvedValue();
    vi.spyOn(retryQueue, 'scheduleRetry').mockResolvedValue();
    vi.spyOn(sharedLogger, 'sharedLogger').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('при ошибке Redis вызывает scheduleRetry и не обновляет сигнатуру', async () => {
    queue.enqueueSignature('sig-retry');

    await __processOneQueueItem({
      chain_id: 'chain-X',
      account: 'acc-X',
      subscription_type: 'regular',
    });

    expect(redisSender.redisPublishLog).toHaveBeenCalled();

    expect(retryQueue.scheduleRetry).toHaveBeenCalledWith('sig-retry');

    expect(subscriptions.updateLastSignature).not.toHaveBeenCalled();

    expect(sharedLogger.sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        message: expect.objectContaining({
          type: 'redis_publish_failed',
          signature: 'sig-retry',
          error: 'Redis broken',
        }),
      })
    );
  });
});
