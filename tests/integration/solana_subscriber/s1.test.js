/// <reference types="vitest" />
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import * as configLoader from '@/services/solana_subscriber/config/configLoader.js';
import * as db from '@/services/solana_subscriber/db/db.js';
import * as rpcPool from '@/services/solana_subscriber/rpc/rpcPool.js';
import * as redisConsumer from '@/services/solana_subscriber/config/redisConsumer.js';
import * as subscriptionManager from '@/services/solana_subscriber/subscription/subscriptionManager.js';
import * as onLogsQueueWorker from '@/services/solana_subscriber/queue/onLogsQueueWorker.js';
import * as redisRetryWorker from '@/services/solana_subscriber/queue/redisRetryQueue.js';
import * as sharedLogger from '@/utils/sharedLogger.js';
import * as subscriptionsDb from '@/services/solana_subscriber/db/subscriptions.js';
import * as startModule from '@/services/solana_subscriber/start.js';

vi.mock('@/services/solana_subscriber/config/configLoader.js');
vi.mock('@/services/solana_subscriber/db/db.js');
vi.mock('@/services/solana_subscriber/rpc/rpcPool.js');
vi.mock('@/services/solana_subscriber/config/redisConsumer.js');
vi.mock('@/services/solana_subscriber/subscription/subscriptionManager.js');
vi.mock('@/services/solana_subscriber/queue/onLogsQueueWorker.js');
vi.mock('@/services/solana_subscriber/queue/redisRetryQueue.js');
vi.mock('@/services/solana_subscriber/db/subscriptions.js');
vi.mock('@/utils/sharedLogger.js');

describe('S1 — запуск микросервиса', () => {
  beforeAll(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  test('должен корректно пройти все этапы старта', async () => {
    db.initPostgres.mockResolvedValue();
    configLoader.loadSubscriberConfig.mockResolvedValue({
      rpc_endpoints: [{ http: 'http://rpc1', ws: 'ws://rpc1' }],
    });
    rpcPool.initRpcPool.mockResolvedValue();
    subscriptionsDb.getActiveSubscriptions.mockResolvedValue([
      { chain_id: 'chain1', account: 'acc1', subscription_type: 'regular' },
    ]);
    subscriptionManager.startAllSubscriptions.mockResolvedValue();
    redisConsumer.startRedisConsumer.mockResolvedValue();
    onLogsQueueWorker.startOnLogsQueueWorker.mockReturnValue();
    redisRetryWorker.startRedisRetryWorker.mockReturnValue();
    sharedLogger.sharedLogger.mockResolvedValue();

    await startModule.start();

    expect(db.initPostgres).toHaveBeenCalled();
    expect(configLoader.loadSubscriberConfig).toHaveBeenCalled();
    expect(rpcPool.initRpcPool).toHaveBeenCalledWith([
      { http: 'http://rpc1', ws: 'ws://rpc1' },
    ]);
    expect(subscriptionsDb.getActiveSubscriptions).toHaveBeenCalled();
    expect(subscriptionManager.startAllSubscriptions).toHaveBeenCalledWith([
      { chain_id: 'chain1', account: 'acc1', subscription_type: 'regular' },
    ]);
    expect(redisConsumer.startRedisConsumer).toHaveBeenCalled();
    expect(onLogsQueueWorker.startOnLogsQueueWorker).toHaveBeenCalled();
    expect(redisRetryWorker.startRedisRetryWorker).toHaveBeenCalled();

    const logMessages = sharedLogger.sharedLogger.mock.calls.map((c) => c[0].message);
    expect(logMessages).toContain('🚀 solana_subscriber успешно запущен');
  });
});
