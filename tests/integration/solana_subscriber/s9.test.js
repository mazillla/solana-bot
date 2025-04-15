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

describe('S9 — все stop* вызываются успешно при shutdown()', () => {
  const originalExit = process.exit;

  beforeEach(() => {
    vi.clearAllMocks();
    process.exit = vi.fn();

    redisConsumer.stopRedisConsumer.mockResolvedValue();
    onLogsQueueWorker.stopOnLogsQueueWorker.mockResolvedValue();
    redisRetryWorker.stopRedisRetryWorker.mockResolvedValue();
    subManager.stopAllSubscriptions.mockResolvedValue();
    rpcPool.closeRpcPool.mockResolvedValue();
    db.closePostgres.mockResolvedValue();
    sharedLogger.sharedLogger.mockResolvedValue();
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  test('все stop-функции вызываются и завершение логируется', async () => {
    await shutdown();

    expect(redisConsumer.stopRedisConsumer).toHaveBeenCalled();
    expect(onLogsQueueWorker.stopOnLogsQueueWorker).toHaveBeenCalled();
    expect(redisRetryWorker.stopRedisRetryWorker).toHaveBeenCalled();
    expect(subManager.stopAllSubscriptions).toHaveBeenCalled();
    expect(rpcPool.closeRpcPool).toHaveBeenCalled();
    expect(db.closePostgres).toHaveBeenCalled();

    const logCall = sharedLogger.sharedLogger.mock.calls.find(
      ([arg]) => arg.message?.includes?.('Завершено корректно')
    );
    expect(logCall).toBeDefined();

    expect(process.exit).toHaveBeenCalledWith(0);
  });
});
