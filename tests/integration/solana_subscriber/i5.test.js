// tests/integration/solana_subscriber/i5.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('i5 — unsubscribeFromAccount удаляет и логирует отписку', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('вызывает removeOnLogsListener, удаляет из Map и логирует', async () => {
    const removeOnLogsListener = vi.fn();

    const fakeKey = 'chainX:Acc1111111111111111111111111111111111111';

    const fakeSub = {
      chain_id: 'chainX',
      account: 'Acc1111111111111111111111111111111111111',
      subscription_type: 'mint',
      rpc_id: 'rpc-99',
      wsConn: { removeOnLogsListener },
      subscriptionId: 123,
    };

    const sharedLogger = vi.fn();
    vi.doMock('@/utils/sharedLogger.js', () => ({ sharedLogger }));

    const {
      unsubscribeFromAccount,
      __activeSubscriptions,
    } = await import('@/services/solana_subscriber/subscription/subscriptionManager.js');

    __activeSubscriptions.set(fakeKey, fakeSub);

    await unsubscribeFromAccount(fakeKey);

    // ✅ Проверки
    expect(removeOnLogsListener).toHaveBeenCalledWith(123);
    expect(__activeSubscriptions.has(fakeKey)).toBe(false);
    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          type: 'unsubscribe',
          chain_id: 'chainX',
          account: 'Acc1111111111111111111111111111111111111',
          subscription_type: 'mint',
        }),
      })
    );
  });
});
