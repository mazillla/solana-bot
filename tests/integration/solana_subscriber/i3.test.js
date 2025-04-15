// tests/integration/solana_subscriber/i3.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('i3 — onLogs вызывает handleLogEvent → redisPublishLog и updateLastSignature', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('обрабатывает событие onLogs через handler', async () => {
    // 🧪 Создаём моки
    const handleLogEvent = vi.fn().mockResolvedValue();
    vi.doMock('@/services/solana_subscriber/subscription/onLogsHandler.js', () => ({
      handleLogEvent,
    }));

    const wsConn = {
      onLogs: vi.fn((pubkey, callback) => {
        // ⚡️ Симулируем входящее событие
        setTimeout(() => {
          callback({ signature: 'FAKE_SIG', err: null });
        }, 10);
        return 999; // subscriptionId
      }),
    };

    const getAvailableRpc = vi.fn().mockResolvedValue({ wsConn, id: 'rpc-1' });
    vi.doMock('@/services/solana_subscriber/rpc/rpcPoolCore.js', () => ({
      getAvailableRpc,
    }));

    // ❗️Подменяем getLastSignatureForAccount, recoverTransactions
    vi.doMock('@/services/solana_subscriber/db/subscriptions.js', () => ({
      getLastSignatureForAccount: vi.fn().mockResolvedValue(null),
    }));

    vi.doMock('@/services/solana_subscriber/subscription/recoveryManager.js', () => ({
      recoverTransactions: vi.fn().mockResolvedValue(),
    }));

    // 🧪 Импортируем после всех моков
    const {
      subscribeToAccount,
    } = await import('@/services/solana_subscriber/subscription/subscriptionManager.js');

    await subscribeToAccount({
      chain_id: 'testnet',
      account: 'SomeAccount11111111111111111111111111111111',
      subscription_type: 'regular',
    });

    await new Promise((r) => setTimeout(r, 50)); // Дать время onLogs

    expect(handleLogEvent).toHaveBeenCalledTimes(1);
    expect(handleLogEvent.mock.calls[0][0].signature).toBe('FAKE_SIG');
  });
});
