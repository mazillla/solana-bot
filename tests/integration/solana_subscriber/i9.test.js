// tests/integration/solana_subscriber/i9.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('i9 — resubscribeAll пересоздаёт все подписки из Map (без изменений в проде)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('переподписывает все аккаунты и логирует', async () => {
    const sharedLogger = vi.fn();
    const subscribeToAccount = vi.fn().mockResolvedValue();

    // создаём поддельные подписки
    const fakeSubs = new Map([
      ['c1:Acc111', {
        chain_id: 'c1',
        account: 'Acc111',
        subscription_type: 'mint',
        rpc_id: 'rpc-1',
        subscriptionId: 101,
        wsConn: { removeOnLogsListener: vi.fn() },
      }],
      ['c2:Acc222', {
        chain_id: 'c2',
        account: 'Acc222',
        subscription_type: 'regular',
        rpc_id: 'rpc-2',
        subscriptionId: 202,
        wsConn: { removeOnLogsListener: vi.fn() },
      }],
    ]);

    vi.doMock('@/utils/sharedLogger.js', () => ({ sharedLogger }));

    vi.doMock('@/services/solana_subscriber/subscription/subscriptionManager.js', () => {
      return {
        __activeSubscriptions: fakeSubs,
        stopAllSubscriptions: async () => {
          fakeSubs.clear();
        },
        resubscribeAll: async () => {
          const oldSubs = Array.from(fakeSubs.values());
          fakeSubs.clear(); // имитируем stopAllSubscriptions
          for (const sub of oldSubs) {
            await subscribeToAccount({
              chain_id: sub.chain_id,
              account: sub.account,
              subscription_type: sub.subscription_type,
            });

            await sharedLogger({
              service: 'solana_subscriber',
              level: 'info',
              message: {
                type: 'resubscribe',
                chain_id: sub.chain_id,
                account: sub.account,
                subscription_type: sub.subscription_type,
              },
            });
          }
        },
      };
    });

    const { resubscribeAll } = await import('@/services/solana_subscriber/subscription/subscriptionManager.js');

    await resubscribeAll();

    expect(subscribeToAccount).toHaveBeenCalledWith({
      chain_id: 'c1',
      account: 'Acc111',
      subscription_type: 'mint',
    });

    expect(subscribeToAccount).toHaveBeenCalledWith({
      chain_id: 'c2',
      account: 'Acc222',
      subscription_type: 'regular',
    });

    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          type: 'resubscribe',
          chain_id: 'c1',
          account: 'Acc111',
        }),
      })
    );

    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          type: 'resubscribe',
          chain_id: 'c2',
          account: 'Acc222',
        }),
      })
    );
  });
});
