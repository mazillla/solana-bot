// tests/integration/solana_subscriber/i13.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('i13 — recoverTransactions восстанавливает до последней в slot-порядке', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('восстанавливает транзакции по slot-порядку и обновляет только последнюю сигнатуру', async () => {
    const redisPublishLog = vi.fn().mockResolvedValue();
    const sharedLogger = vi.fn();
    const updateLastSignature = vi.fn().mockResolvedValue();

    const getSignaturesForAddressWithTimeout = vi.fn().mockResolvedValue([
      { signature: 'sigA', slot: 4, confirmationStatus: 'confirmed' },
      { signature: 'sigB', slot: 2, confirmationStatus: 'confirmed' },
      { signature: 'sigC', slot: 7, confirmationStatus: 'confirmed' },
    ]);

    const getParsedTransactionWithTimeout = vi.fn(async (_rpc, sig) => ({
      slot: { sigA: 4, sigB: 2, sigC: 7 }[sig],
      blockTime: 1710000000 + { sigA: 1, sigB: 2, sigC: 3 }[sig],
      meta: { err: null },
    }));

    vi.doMock('@/services/solana_subscriber/utils/redisLogSender.js', () => ({ redisPublishLog }));
    vi.doMock('@/utils/sharedLogger.js', () => ({ sharedLogger }));
    vi.doMock('@/services/solana_subscriber/db/subscriptions.js', () => ({ updateLastSignature }));
    vi.doMock('@/services/solana_subscriber/rpc/rpcUtils.js', () => ({
      getSignaturesForAddressWithTimeout,
      getParsedTransactionWithTimeout,
    }));
    vi.doMock('@/services/solana_subscriber/rpc/rpcPool.js', () => ({
      getAvailableRpc: () => ({ id: 'mockRpc' }),
    }));

    const { recoverTransactions } = await import('@/services/solana_subscriber/subscription/recoveryManager.js');

    await recoverTransactions({
      chain_id: 'c1',
      account: 'AccXYZ',
      last_signature: 'sigFinal',
      subscription_type: 'regular',
    });

    // ✅ Проверка порядка (slot: 2, 4, 7 → sigB, sigA, sigC)
    expect(redisPublishLog.mock.calls[0][1].signature).toBe('sigB');
    expect(redisPublishLog.mock.calls[1][1].signature).toBe('sigA');
    expect(redisPublishLog.mock.calls[2][1].signature).toBe('sigC');

    // ✅ updateLastSignature вызывается только один раз
    expect(updateLastSignature).toHaveBeenCalledTimes(1);
    expect(updateLastSignature).toHaveBeenCalledWith('c1', 'AccXYZ', 'sigC');
  });
});
