import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { __processOneQueueItem } from '@/services/solana_subscriber/queue/onLogsQueueWorker.js';
import * as queue from '@/services/solana_subscriber/queue/onLogsQueue.js';
import * as rpcPool from '@/services/solana_subscriber/rpc/rpcPool.js';
import * as rpcUtils from '@/services/solana_subscriber/rpc/rpcUtils.js';
import * as redisSender from '@/services/solana_subscriber/utils/redisLogSender.js';
import * as subscriptions from '@/services/solana_subscriber/db/subscriptions.js';
import * as sharedLogger from '@/utils/sharedLogger.js';

describe('S21: Лог обрабатывается через очередь', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(rpcPool, 'getAvailableRpc').mockResolvedValue({ id: 'rpc-1', httpConn: {}, wsConn: {} });

    vi.spyOn(rpcUtils, 'getParsedTransactionWithTimeout').mockResolvedValue({
      meta: null,
      blockTime: 1234567890,
    });

    vi.spyOn(redisSender, 'redisPublishLog').mockResolvedValue();
    vi.spyOn(subscriptions, 'updateLastSignature').mockResolvedValue();
    vi.spyOn(sharedLogger, 'sharedLogger').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('обрабатывает одну транзакцию из очереди', async () => {
    // Заранее добавим сигнатуру в очередь
    queue.enqueueSignature('sig123');

    await __processOneQueueItem({
      chain_id: 'test-chain',
      account: 'test-account',
      subscription_type: 'regular',
    });

    // Проверяем, что она дошла до Redis
    expect(redisSender.redisPublishLog).toHaveBeenCalledWith(
      'solana_logs_regular',
      expect.objectContaining({
        chain_id: 'test-chain',
        account: 'test-account',
        signature: 'sig123',
      })
    );

    expect(subscriptions.updateLastSignature).toHaveBeenCalledWith(
      'test-chain',
      'test-account',
      'sig123'
    );

    expect(sharedLogger.sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'info',
        message: expect.objectContaining({
          type: 'transaction_dispatched_from_queue',
          signature: 'sig123',
          rpc_id: 'rpc-1',
        }),
      })
    );
  });
});
