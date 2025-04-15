// tests/integration/solana_subscriber/i4.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('i4 — subscribeToAccount не дублирует подписку, если уже есть', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('не вызывает повторно onLogs и не добавляет дубликат в activeSubscriptions', async () => {
    const onLogsSpy = vi.fn().mockReturnValue(42); // Мокаем wsConn.onLogs

    const wsConn = {
      onLogs: onLogsSpy,
    };

    const getAvailableRpc = vi.fn().mockResolvedValue({
      wsConn,
      id: 'rpc-main',
    });

    const getLastSignatureForAccount = vi.fn().mockResolvedValue(null);
    const recoverTransactions = vi.fn().mockResolvedValue();

    vi.doMock('@/services/solana_subscriber/rpc/rpcPoolCore.js', () => ({
      getAvailableRpc,
    }));

    vi.doMock('@/services/solana_subscriber/db/subscriptions.js', () => ({
      getLastSignatureForAccount,
    }));

    vi.doMock('@/services/solana_subscriber/subscription/recoveryManager.js', () => ({
      recoverTransactions,
    }));

    const {
      subscribeToAccount,
      __activeSubscriptions,
    } = await import('@/services/solana_subscriber/subscription/subscriptionManager.js');

    const testSub = {
      chain_id: 'testnet',
      account: 'Acc111111111111111111111111111111111111111',
      subscription_type: 'regular',
    };

    // Первая подписка
    await subscribeToAccount(testSub);
    // Повторная
    await subscribeToAccount(testSub);

    // ✅ Проверки
    expect(onLogsSpy).toHaveBeenCalledTimes(1);
    expect(__activeSubscriptions.size).toBe(1);
    const key = `${testSub.chain_id}:${testSub.account}`;
    expect(__activeSubscriptions.has(key)).toBe(true);
  });
});
