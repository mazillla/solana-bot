import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleLogEvent } from '@/services/solana_subscriber/subscription/onLogsHandler.js';
import * as rpcUtils from '@/services/solana_subscriber/rpc/rpcUtils.js';
import * as retryQueue from '@/services/solana_subscriber/queue/retryQueue.js';
import * as redisSender from '@/services/solana_subscriber/utils/redisLogSender.js';
import * as subscriptions from '@/services/solana_subscriber/db/subscriptions.js';
import * as sharedLogger from '@/utils/sharedLogger.js';
import { getCurrentConfig } from '@/services/solana_subscriber/config/configLoader.js';

vi.mock('@/services/solana_subscriber/config/configLoader.js', () => ({
  getCurrentConfig: vi.fn(),
}));

describe('S15: getParsedTransaction возвращает null и вызывает повторную попытку', () => {
  beforeEach(() => {
    vi.spyOn(rpcUtils, 'getParsedTransactionWithTimeout').mockResolvedValue(null);
    vi.spyOn(retryQueue, 'scheduleRetry').mockResolvedValue();
    vi.spyOn(redisSender, 'redisPublishLog').mockResolvedValue();
    vi.spyOn(subscriptions, 'updateLastSignature').mockResolvedValue();
    vi.spyOn(sharedLogger, 'sharedLogger').mockResolvedValue();
    getCurrentConfig.mockReturnValue({ rpc_timeout_ms: 5000 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('должен вызвать scheduleRetry и не отправлять лог в Redis', async () => {
    const params = {
      chain_id: 'test-chain',
      account: 'test-account',
      signature: 'missing-signature',
      subscription_type: 'regular',
      rpc: { id: 'test-rpc', limiter: { removeToken: () => true } },
    };

    await handleLogEvent(params);

    expect(rpcUtils.getParsedTransactionWithTimeout).toHaveBeenCalledWith(params.rpc, 'missing-signature');

    expect(retryQueue.scheduleRetry).toHaveBeenCalledWith('missing-signature');

    expect(redisSender.redisPublishLog).not.toHaveBeenCalled();
    expect(subscriptions.updateLastSignature).not.toHaveBeenCalled();

    expect(sharedLogger.sharedLogger).not.toHaveBeenCalledWith(expect.objectContaining({
      message: expect.objectContaining({
        type: 'transaction_dispatched',
      }),
    }));
  });
});
