import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as db from '@/services/solana_subscriber/db/subscriptions.js';
import * as subscriptionManager from '@/services/solana_subscriber/subscription/subscriptionManager.js';
import * as configLoader from '@/services/solana_subscriber/config/configLoader.js';
import * as rpcPool from '@/services/solana_subscriber/rpc/rpcPool.js';
import * as dbInit from '@/services/solana_subscriber/db/db.js';
import * as sharedLogger from '@/utils/sharedLogger.js';
import { start } from '@/services/solana_subscriber/start.js';

describe('D5: Рестарт без потери подписок и last_signature', () => {
  const fakeSubscriptions = [
    { chain_id: 'chainX', account: 'accX', subscription_type: 'regular' },
    { chain_id: 'chainY', account: 'accY', subscription_type: 'spl_token' },
  ];

  const subscribeSpy = vi.fn().mockResolvedValue();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(sharedLogger, 'sharedLogger').mockResolvedValue();

    vi.spyOn(dbInit, 'initPostgres').mockResolvedValue();
    vi.spyOn(configLoader, 'loadSubscriberConfig').mockResolvedValue({
      rpc_endpoints: [{ http: 'http://rpc1', ws: 'ws://rpc1' }],
    });
    vi.spyOn(rpcPool, 'initRpcPool').mockResolvedValue();

    vi.spyOn(db, 'getActiveSubscriptions').mockResolvedValue(fakeSubscriptions);
    vi.spyOn(subscriptionManager, 'startAllSubscriptions').mockImplementation(async (subs) => {
      for (const sub of subs) {
        await subscribeSpy(sub);
      }
    });

    globalThis.__mockedSubscribeToAccount = subscribeSpy;
  });

  afterEach(() => {
    globalThis.__mockedSubscribeToAccount = null;
    vi.restoreAllMocks();
  });

  it('поднимает подписки и восстанавливает их при старте', async () => {
    await start();

    expect(dbInit.initPostgres).toHaveBeenCalled();
    expect(configLoader.loadSubscriberConfig).toHaveBeenCalled();
    expect(rpcPool.initRpcPool).toHaveBeenCalled();
    expect(db.getActiveSubscriptions).toHaveBeenCalled();

    expect(subscribeSpy).toHaveBeenCalledTimes(2);
    expect(subscribeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ chain_id: 'chainX', account: 'accX', subscription_type: 'regular' }),
    );
    expect(subscribeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ chain_id: 'chainY', account: 'accY', subscription_type: 'spl_token' }),
    );
  });
});
