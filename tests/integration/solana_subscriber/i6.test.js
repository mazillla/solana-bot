// tests/integration/solana_subscriber/i6.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('i6 — pollStream обрабатывает несколько команд подряд', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('вызывает соответствующие обработчики для каждой команды', async () => {
    const subscribeToAccount = vi.fn().mockResolvedValue();
    const unsubscribeFromAccount = vi.fn().mockResolvedValue();
    const updateAndReloadConfig = vi.fn().mockResolvedValue();
    const resubscribeAll = vi.fn().mockResolvedValue();

    const sharedLogger = vi.fn();

    // ✅ Мокаем зависимости
    vi.doMock('@/services/solana_subscriber/subscription/subscriptionManager.js', () => ({
      subscribeToAccount,
      unsubscribeFromAccount,
      resubscribeAll,
    }));

    vi.doMock('@/services/solana_subscriber/config/configLoader.js', () => ({
      updateAndReloadConfig,
    }));

    vi.doMock('@/utils/sharedLogger.js', () => ({ sharedLogger }));

    const {
      processRedisCommand,
    } = await import('@/services/solana_subscriber/config/redisConsumer.js');

    // 🧪 Прогоняем три команды
    await processRedisCommand({
      action: 'subscribe',
      chain_id: 'c1',
      account: 'A1',
      subscription_type: 'mint',
    });

    await processRedisCommand({
      action: 'unsubscribe',
      chain_id: 'c2',
      account: 'A2',
    });

    await processRedisCommand({
      action: 'update_config',
    });

    // ✅ Проверки
    expect(subscribeToAccount).toHaveBeenCalledWith({
      chain_id: 'c1',
      account: 'A1',
      subscription_type: 'mint',
    });

    expect(unsubscribeFromAccount).toHaveBeenCalledWith('c2:A2');
    expect(updateAndReloadConfig).toHaveBeenCalledTimes(1);
    expect(resubscribeAll).toHaveBeenCalledTimes(1);
  });
});
