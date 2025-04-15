// tests/integration/solana_subscriber/i8.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('i8 — handleDisconnect вызывает восстановление пула и подписок', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('вызывает closeRpcPool, initRpcPool, resubscribeAll и логирует восстановление', async () => {
    const sharedLogger = vi.fn();
    const closeRpcPool = vi.fn().mockResolvedValue();
    const initRpcPool = vi.fn().mockResolvedValue();
    const resubscribeAll = vi.fn().mockResolvedValue();

    const mockConfig = {
      rpc_endpoints: [
        {
          http: 'https://rpc1',
          ws: 'wss://rpc1',
          rate_limits: { max_requests_per_sec: 10 },
        },
      ],
    };

    // 🧠 Все моки — ДО импорта handleDisconnect
    vi.doMock('@/utils/sharedLogger.js', () => ({ sharedLogger }));

    vi.doMock('@/services/solana_subscriber/config/configLoader.js', () => ({
      getCurrentConfig: () => mockConfig,
    }));

    vi.doMock('@/services/solana_subscriber/subscription/subscriptionManager.js', () => ({
      resubscribeAll,
    }));

    vi.doMock('@/services/solana_subscriber/rpc/rpcPoolCore.js', () => ({
      closeRpcPool,
    }));

    // ❗ Мок для динамического импорта внутри handleDisconnect
    vi.doMock('@/services/solana_subscriber/rpc/rpcPool.js', () => ({
      initRpcPool,
    }));

    const { handleDisconnect } = await import('@/services/solana_subscriber/rpc/handleDisconnect.js');

    await handleDisconnect('rpc-1');

    // ✅ Проверки
    expect(closeRpcPool).toHaveBeenCalledTimes(1);
    expect(initRpcPool).toHaveBeenCalledWith(mockConfig.rpc_endpoints);
    expect(resubscribeAll).toHaveBeenCalledTimes(1);

    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'solana_subscriber',
        level: 'warn',
        message: expect.objectContaining({
          type: 'ws_disconnect',
          rpc_id: 'rpc-1',
        }),
      })
    );

    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'solana_subscriber',
        level: 'info',
        message: expect.objectContaining({
          type: 'reconnect',
          rpc_id: 'rpc-1',
        }),
      })
    );
  });
});
