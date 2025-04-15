import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as subscriptionManager from '@/services/solana_subscriber/subscription/subscriptionManager.js';

describe('D4: Подписка onLogs обрывается → происходит resubscribe', () => {
  let spy;

  beforeEach(() => {
    vi.restoreAllMocks();
    spy = vi.fn().mockResolvedValue();

    // 👇️ подменяем subscribeToAccount на spy через globalThis
    globalThis.__mockedSubscribeToAccount = spy;

    // 🧪 загружаем фейковые подписки в Map
    subscriptionManager.__activeSubscriptions.set('chain1:acc1', {
      chain_id: 'chain1',
      account: 'acc1',
      subscription_type: 'regular',
    });
    subscriptionManager.__activeSubscriptions.set('chain2:acc2', {
      chain_id: 'chain2',
      account: 'acc2',
      subscription_type: 'spl_token',
    });
  });

  afterEach(() => {
    globalThis.__mockedSubscribeToAccount = null;
    subscriptionManager.__activeSubscriptions.clear();
    vi.restoreAllMocks();
  });

  it('вызывает повторную подписку на все аккаунты', async () => {
    await subscriptionManager.resubscribeAll();

    expect(spy).toHaveBeenCalledTimes(2);

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ chain_id: 'chain1', account: 'acc1', subscription_type: 'regular' }),
    );

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ chain_id: 'chain2', account: 'acc2', subscription_type: 'spl_token' }),
    );
  });
});
