// tests/integration/solana_subscriber/i11.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('i11 — unsubscribeFromAccount корректно удаляет подписку', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('удаляет подписку, вызывает removeOnLogsListener и логирует', async () => {
    const sharedLogger = vi.fn();

    vi.doMock('@/utils/sharedLogger.js', () => ({ sharedLogger }));

    const {
      unsubscribeFromAccount,
      __activeSubscriptions,
    } = await import('@/services/solana_subscriber/subscription/subscriptionManager.js');

    const key = 'c9:ABC123';

    const removeOnLogsListener = vi.fn();

    __activeSubscriptions.set(key, {
      chain_id: 'c9',
      account: 'ABC123',
      subscription_type: 'regular',
      rpc_id: 'rpc-77',
      subscriptionId: 999,
      wsConn: { removeOnLogsListener },
    });

    await unsubscribeFromAccount(key);

    // ✅ Проверка, что removeOnLogsListener вызван
    expect(removeOnLogsListener).toHaveBeenCalledWith(999);

    // ✅ Подписка удалена из Map
    expect(__activeSubscriptions.has(key)).toBe(false);

    // ✅ Лог отписки записан
    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'solana_subscriber',
        level: 'info',
        message: expect.objectContaining({
          type: 'unsubscribe',
          chain_id: 'c9',
          account: 'ABC123',
          subscription_type: 'regular',
          rpc_id: 'rpc-77',
        }),
      })
    );
  });
});
