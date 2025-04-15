// tests/integration/solana_subscriber/i14.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('i14 — Redis падает во время восстановления → last_signature не обновляется', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('не вызывает updateLastSignature, если Redis упал хотя бы на одной транзакции', async () => {
    const sharedLogger = vi.fn();
    const updateLastSignature = vi.fn();
    const redisPublishLog = vi.fn()
      .mockResolvedValueOnce()  // sigA — успех
      .mockRejectedValueOnce(new Error('Redis is down')); // sigB — провал

    const getSignaturesForAddressWithTimeout = vi.fn().mockResolvedValue([
      { signature: 'sigA', slot: 1, confirmationStatus: 'confirmed' },
      { signature: 'sigB', slot: 2, confirmationStatus: 'confirmed' },
    ]);

    const getParsedTransactionWithTimeout = vi.fn(async (_rpc, sig) => ({
      slot: { sigA: 1, sigB: 2 }[sig],
      blockTime: 1710000000 + { sigA: 1, sigB: 2 }[sig],
      meta: { err: null },
    }));

    vi.doMock('@/utils/sharedLogger.js', () => ({ sharedLogger }));
    vi.doMock('@/services/solana_subscriber/utils/redisLogSender.js', () => ({ redisPublishLog }));
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
      chain_id: 'c3',
      account: 'Acc555',
      last_signature: 'sigLast',
      subscription_type: 'regular',
    });

    // ✅ Один из вызовов Redis упал → updateLastSignature НЕ вызывается
    expect(updateLastSignature).not.toHaveBeenCalled();

    // ✅ Лог ошибки в Redis должен быть записан
    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          type: 'recovery_publish_failed',
          signature: 'sigB',
        }),
      })
    );
  });
});
