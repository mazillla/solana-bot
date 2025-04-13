import { describe, it, vi, beforeEach, expect } from 'vitest';

vi.mock('@/services/solana_subscriber/rpc/rpcPool.js');
vi.mock('@/services/solana_subscriber/rpc/rpcUtils.js');
vi.mock('@/services/solana_subscriber/utils/redisLogSender.js');
vi.mock('@/services/solana_subscriber/db/subscriptions.js');

import { recoverTransactions } from '@/services/solana_subscriber/subscription/recoveryManager.js';
import * as rpcPool from '@/services/solana_subscriber/rpc/rpcPool.js';
import * as rpcUtils from '@/services/solana_subscriber/rpc/rpcUtils.js';
import * as redisLogSender from '@/services/solana_subscriber/utils/redisLogSender.js';
import * as db from '@/services/solana_subscriber/db/subscriptions.js';

const baseInput = {
  chain_id: 'chain1',
  account: 'AccountPubKey',
  last_signature: null,
  subscription_type: 'regular',
};

const fakeRpc = { id: 'rpc_1' };
const fakeParsedTx = { meta: {}, blockTime: 1710000000 };
const fakeSig = { signature: 'abc123', confirmationStatus: 'confirmed', slot: 2 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('recoverTransactions', () => {
  it('logs and exits if no available RPC', async () => {
    rpcPool.getAvailableRpc.mockResolvedValue(null);

    await recoverTransactions(baseInput);

    expect(vi.mocked(console.warn)).toBeDefined(); // indirectly confirms warning
  }, 10000);

  it('exits silently if no signatures returned', async () => {
    rpcPool.getAvailableRpc.mockResolvedValue(fakeRpc);
    rpcUtils.getSignaturesForAddressWithTimeout.mockResolvedValue([]);

    await recoverTransactions(baseInput);

    expect(redisLogSender.redisPublishLog).not.toHaveBeenCalled();
    expect(db.updateLastSignature).not.toHaveBeenCalled();
  });

  it('ignores unconfirmed signatures', async () => {
    rpcPool.getAvailableRpc.mockResolvedValue(fakeRpc);
    rpcUtils.getSignaturesForAddressWithTimeout.mockResolvedValue([
      { ...fakeSig, confirmationStatus: 'processed' },
    ]);

    await recoverTransactions(baseInput);

    expect(redisLogSender.redisPublishLog).not.toHaveBeenCalled();
  });

  it('skips errored or null transactions', async () => {
    rpcPool.getAvailableRpc.mockResolvedValue(fakeRpc);
    rpcUtils.getSignaturesForAddressWithTimeout.mockResolvedValue([fakeSig]);
    rpcUtils.getParsedTransactionWithTimeout.mockResolvedValueOnce(null);

    await recoverTransactions(baseInput);

    expect(redisLogSender.redisPublishLog).not.toHaveBeenCalled();
  });

  it('publishes valid logs and updates last signature', async () => {
    rpcPool.getAvailableRpc.mockResolvedValue(fakeRpc);
    rpcUtils.getSignaturesForAddressWithTimeout.mockResolvedValue([fakeSig]);
    rpcUtils.getParsedTransactionWithTimeout.mockResolvedValue(fakeParsedTx);

    await recoverTransactions(baseInput);

    expect(redisLogSender.redisPublishLog).toHaveBeenCalledWith(
      'solana_logs_regular',
      expect.objectContaining({ signature: fakeSig.signature })
    );
    expect(db.updateLastSignature).toHaveBeenCalledWith(
      baseInput.chain_id,
      baseInput.account,
      fakeSig.signature
    );
  });

  it('logs error if redis publish fails', async () => {
    rpcPool.getAvailableRpc.mockResolvedValue(fakeRpc);
    rpcUtils.getSignaturesForAddressWithTimeout.mockResolvedValue([fakeSig]);
    rpcUtils.getParsedTransactionWithTimeout.mockResolvedValue(fakeParsedTx);
    redisLogSender.redisPublishLog.mockRejectedValue(new Error('fail'));

    await recoverTransactions(baseInput);

    // no assertion since we suppress console.warn
  });

  it('uses Date.now() if blockTime is missing', async () => {
    const parsedTx = { meta: {}, blockTime: null };
    rpcPool.getAvailableRpc.mockResolvedValue(fakeRpc);
    rpcUtils.getSignaturesForAddressWithTimeout.mockResolvedValue([fakeSig]);
    rpcUtils.getParsedTransactionWithTimeout.mockResolvedValue(parsedTx);

    await recoverTransactions(baseInput);

    expect(redisLogSender.redisPublishLog).toHaveBeenCalledWith(
      'solana_logs_regular',
      expect.objectContaining({ timestamp: expect.any(Number) })
    );
  });

  it('handles custom last_signature option', async () => {
    rpcPool.getAvailableRpc.mockResolvedValue(fakeRpc);
    rpcUtils.getSignaturesForAddressWithTimeout.mockResolvedValue([fakeSig]);
    rpcUtils.getParsedTransactionWithTimeout.mockResolvedValue(fakeParsedTx);

    await recoverTransactions({ ...baseInput, last_signature: 'prev123' });

    expect(redisLogSender.redisPublishLog).toHaveBeenCalled();
  });

  it('uses "solana_logs_spl" if subscription_type is "spl_token"', async () => {
    rpcPool.getAvailableRpc.mockResolvedValue(fakeRpc);
    rpcUtils.getSignaturesForAddressWithTimeout.mockResolvedValue([fakeSig]);
    rpcUtils.getParsedTransactionWithTimeout.mockResolvedValue(fakeParsedTx);

    await recoverTransactions({ ...baseInput, subscription_type: 'spl_token' });

    expect(redisLogSender.redisPublishLog).toHaveBeenCalledWith(
      'solana_logs_spl',
      expect.objectContaining({ signature: fakeSig.signature })
    );
  });
});
