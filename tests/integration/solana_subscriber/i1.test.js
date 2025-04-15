// tests/integration/solana_subscriber/I1.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('I1 — update_config через Redis → вызывает updateAndReloadConfig + resubscribeAll', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('вызывает updateAndReloadConfig и resubscribeAll', async () => {
    // 🧪 Мокаем импорты, которые динамически вызываются в handleUpdateConfigCommand
    const updateAndReloadConfig = vi.fn().mockResolvedValue({});
    const resubscribeAll = vi.fn().mockResolvedValue();

    vi.doMock('@/services/solana_subscriber/config/configLoader.js', () => ({
      updateAndReloadConfig,
    }));

    vi.doMock('@/services/solana_subscriber/subscription/subscriptionManager.js', () => ({
      resubscribeAll,
    }));

    // 🧪 Импортируем handleUpdateConfigCommand с уже замоканными модулями
    const { handleUpdateConfigCommand } = await import('@/services/solana_subscriber/config/redisConsumer.js');

    await handleUpdateConfigCommand();

    expect(updateAndReloadConfig).toHaveBeenCalledTimes(1);
    expect(resubscribeAll).toHaveBeenCalledTimes(1);
  });
});
