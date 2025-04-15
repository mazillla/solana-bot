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

describe('S12 — повторный вызов shutdown безопасен', () => {
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

  test('два вызова shutdown не приводят к ошибке', async () => {
    await shutdown();
    await shutdown(); // повторный вызов

    // Функции всё равно не вызываются более одного раза
    expect(redisConsumer.stopRedisConsumer).toHaveBeenCalledTimes(1);
    expect(onLogsQueueWorker.stopOnLogsQueueWorker).toHaveBeenCalledTimes(1);
    expect(redisRetryWorker.stopRedisRetryWorker).toHaveBeenCalledTimes(1);
    expect(subManager.stopAllSubscriptions).toHaveBeenCalledTimes(1);
    expect(rpcPool.closeRpcPool).toHaveBeenCalledTimes(1);
    expect(db.closePostgres).toHaveBeenCalledTimes(1);

    expect(process.exit).toHaveBeenCalledTimes(1); // только первый вызов
  });
});
