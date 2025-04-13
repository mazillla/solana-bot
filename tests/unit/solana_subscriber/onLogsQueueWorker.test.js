import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/services/solana_subscriber/rpc/rpcPool.js', () => ({
  getAvailableRpc: vi.fn(),
}));
vi.mock('@/services/solana_subscriber/rpc/rpcUtils.js', () => ({
  getParsedTransactionWithTimeout: vi.fn(),
}));
vi.mock('@/services/solana_subscriber/utils/redisLogSender.js', () => ({
  redisPublishLog: vi.fn(),
}));
vi.mock('@/services/solana_subscriber/db/subscriptions.js', () => ({
  updateLastSignature: vi.fn(),
}));
vi.mock('@/services/solana_subscriber/queue/retryQueue.js', () => ({
  scheduleRetry: vi.fn(),
}));
vi.mock('@/utils/sharedLogger.js', () => ({
  sharedLogger: vi.fn(),
}));

import * as onLogsQueue from '@/services/solana_subscriber/queue/onLogsQueue.js';
import {
  startOnLogsQueueWorker,
  stopOnLogsQueueWorker,
} from '@/services/solana_subscriber/queue/onLogsQueueWorker.js';
import { getAvailableRpc } from '@/services/solana_subscriber/rpc/rpcPool.js';
import { getParsedTransactionWithTimeout } from '@/services/solana_subscriber/rpc/rpcUtils.js';
import { redisPublishLog } from '@/services/solana_subscriber/utils/redisLogSender.js';
import { sharedLogger } from '@/utils/sharedLogger.js';
import { scheduleRetry } from '@/services/solana_subscriber/queue/retryQueue.js';

describe('onLogsQueueWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    stopOnLogsQueueWorker();
  });

  it('обрабатывает успешную транзакцию', async () => {
    onLogsQueue.enqueueSignature('sig-ok');

    getAvailableRpc.mockResolvedValue({ id: 'rpc-1' });
    getParsedTransactionWithTimeout.mockResolvedValue({
      meta: {},
      blockTime: 1710000000,
    });
    redisPublishLog.mockResolvedValue();

    startOnLogsQueueWorker();
    await new Promise((r) => setTimeout(r, 2500));
    stopOnLogsQueueWorker();

    expect(redisPublishLog).toHaveBeenCalledWith(
      'solana_logs_regular',
      expect.objectContaining({
        signature: 'sig-ok',
        timestamp: 1710000000 * 1000,
      })
    );

    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'info',
        message: expect.objectContaining({
          type: 'transaction_dispatched_from_queue',
          signature: 'sig-ok',
        }),
      })
    );
  });

  it('если нет rpc — возвращает в очередь и логирует только resume', async () => {
    onLogsQueue.enqueueSignature('sig-norpc');
    getAvailableRpc.mockResolvedValue(null);

    startOnLogsQueueWorker();
    await new Promise((r) => setTimeout(r, 2500));
    stopOnLogsQueueWorker();

    expect(onLogsQueue.getQueueLength()).toBe(1);
    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          event: 'queue_resumed',
        }),
      })
    );
  });

  it('если parsed null → scheduleRetry вызывается', async () => {
    onLogsQueue.enqueueSignature('sig-null');
    getAvailableRpc.mockResolvedValue({ id: 'rpc-2' });
    getParsedTransactionWithTimeout.mockResolvedValue(null);

    startOnLogsQueueWorker();
    await new Promise((r) => setTimeout(r, 2500));
    stopOnLogsQueueWorker();

    expect(scheduleRetry).toHaveBeenCalledWith('sig-null');
  });

  it('если meta.err — логирует warn и не отправляет', async () => {
    onLogsQueue.enqueueSignature('sig-fail');
    getAvailableRpc.mockResolvedValue({ id: 'rpc-3' });
    getParsedTransactionWithTimeout.mockResolvedValue({
      meta: { err: 'SomeError' },
    });

    startOnLogsQueueWorker();
    await new Promise((r) => setTimeout(r, 2500));
    stopOnLogsQueueWorker();

    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warn',
        message: expect.objectContaining({
          type: 'failed_transaction',
          signature: 'sig-fail',
        }),
      })
    );

    expect(redisPublishLog).not.toHaveBeenCalled();
  });

  it('если redisPublishLog кидает ошибку — логирует error и вызывает retry', async () => {
    onLogsQueue.enqueueSignature('sig-redis-fail');
    getAvailableRpc.mockResolvedValue({ id: 'rpc-4' });
    getParsedTransactionWithTimeout.mockResolvedValue({
      meta: {},
      blockTime: 1710000000,
    });
    redisPublishLog.mockRejectedValue(new Error('Redis down'));

    startOnLogsQueueWorker();
    await new Promise((r) => setTimeout(r, 2500));
    stopOnLogsQueueWorker();

    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        message: expect.objectContaining({
          type: 'redis_publish_failed',
          signature: 'sig-redis-fail',
        }),
      })
    );

    expect(scheduleRetry).toHaveBeenCalledWith('sig-redis-fail');
  });
  it('если blockTime отсутствует — используется Date.now()', async () => {
    const mockNow = 1720000000000;
    vi.spyOn(Date, 'now').mockReturnValue(mockNow);
  
    onLogsQueue.enqueueSignature('sig-noblocktime');
    getAvailableRpc.mockResolvedValue({ id: 'rpc-5' });
    getParsedTransactionWithTimeout.mockResolvedValue({
      meta: {},
      blockTime: null,
    });
    redisPublishLog.mockResolvedValue();
  
    startOnLogsQueueWorker();
    await new Promise((r) => setTimeout(r, 2500));
    stopOnLogsQueueWorker();
  
    expect(redisPublishLog).toHaveBeenCalledWith(
      'solana_logs_regular',
      expect.objectContaining({
        signature: 'sig-noblocktime',
        timestamp: mockNow,
      })
    );
  
    Date.now.mockRestore();
  });
  
});
