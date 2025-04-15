import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { recoverTransactions } from '@/services/solana_subscriber/subscription/recoveryManager.js';
import * as rpcUtils from '@/services/solana_subscriber/rpc/rpcUtils.js';
import * as rpcPool from '@/services/solana_subscriber/rpc/rpcPool.js';
import * as redisSender from '@/services/solana_subscriber/utils/redisLogSender.js';
import * as subscriptions from '@/services/solana_subscriber/db/subscriptions.js';
import * as sharedLogger from '@/utils/sharedLogger.js';

describe('S19: Ошибка в getSignaturesForAddressWithTimeout', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(rpcPool, 'getAvailableRpc').mockResolvedValue({ id: 'rpc-test', httpConn: {}, wsConn: {} });

    vi.spyOn(rpcUtils, 'getSignaturesForAddressWithTimeout').mockResolvedValue(null); // ← важный момент

    vi.spyOn(rpcUtils, 'getParsedTransactionWithTimeout').mockResolvedValue({});
    vi.spyOn(redisSender, 'redisPublishLog').mockResolvedValue();
    vi.spyOn(subscriptions, 'updateLastSignature').mockResolvedValue();
    vi.spyOn(sharedLogger, 'sharedLogger').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('не восстанавливает ничего и логирует только начало', async () => {
    const params = {
      chain_id: 'test-chain',
      account: 'test-account',
      last_signature: 'sig0',
      subscription_type: 'regular',
    };

    await recoverTransactions(params);

    expect(rpcPool.getAvailableRpc).toHaveBeenCalled();
    expect(rpcUtils.getSignaturesForAddressWithTimeout).toHaveBeenCalled();

    expect(rpcUtils.getParsedTransactionWithTimeout).not.toHaveBeenCalled();
    expect(redisSender.redisPublishLog).not.toHaveBeenCalled();
    expect(subscriptions.updateLastSignature).not.toHaveBeenCalled();

    expect(sharedLogger.sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'info',
        message: expect.objectContaining({
          type: 'recovery_started',
          chain_id: 'test-chain',
          account: 'test-account',
          rpc_id: 'rpc-test',
        }),
      })
    );
  });
});
