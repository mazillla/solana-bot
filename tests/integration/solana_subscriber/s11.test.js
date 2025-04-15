/// <reference types="vitest" />
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import * as redisConsumer from '@/services/solana_subscriber/config/redisConsumer.js';
import * as onLogsQueueWorker from '@/services/solana_subscriber/queue/onLogsQueueWorker.js';
import * as redisRetryWorker from '@/services/solana_subscriber/queue/redisRetryQueue.js';
import * as subManager from '@/services/solana_subscriber/subscription/subscriptionManager.js';
import * as rpcPool from '@/services/solana_subscriber/rpc/rpcPool.js';
import * as db from '@/services/solana_subscriber/db/db.js';
import * as sharedLogger from '@/utils/sharedLogger.js';
import { shutdown } from '@/services/solana_subscriber/start.js';

vi.mock('@/services/solana_subscriber/config/redisConsumer.js');
vi.mock('@/services/solana_subscriber/queue/onLogsQueueWorker.js');
vi.mock('@/services/solana_subscriber/queue/redisRetryQueue.js');
vi.mock('@/services/solana_subscriber/subscription/subscriptionManager.js');
vi.mock('@/services/solana_subscriber/rpc/rpcPool.js');
vi.mock('@/services/solana_subscriber/db/db.js');
vi.mock('@/utils/sharedLogger.js');

describe('S11 — stopAllSubscriptions выбрасывает ошибку', () => {
  const originalExit = process.exit;

  beforeEach(() => {
    vi.clearAllMocks();
    process.exit = vi.fn();

    redisConsumer.stopRedisConsumer.mockResolvedValue();
    onLogsQueueWorker.stopOnLogsQueueWorker.mockResolvedValue();
    redisRetryWorker.stopRedisRetryWorker.mockResolvedValue();
    subManager.stopAllSubscriptions.mockRejectedValue(new Error('stop subscriptions failed'));
    rpcPool.closeRpcPool.mockResolvedValue();
    db.closePostgres.mockResolvedValue();
    sharedLogger.sharedLogger.mockResolvedValue();
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  test('ошибка в stopAllSubscriptions логируется и завершает с exit(1)', async () => {
    await shutdown();

    const logCall = sharedLogger.sharedLogger.mock.calls.find(
      ([arg]) => arg.message?.includes?.('Ошибка при завершении: stop subscriptions failed')
    );
    expect(logCall).toBeDefined();

    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
