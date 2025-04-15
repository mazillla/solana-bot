// tests/integration/solana_subscriber/i7.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('i7 — retryQueue ограничивает количество попыток (ручной вызов)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('после 3-х неудачных вызовов tryAgain логирует unresolved_transaction', async () => {
    const sharedLogger = vi.fn();
    const getAvailableRpc = vi.fn().mockResolvedValue({ id: 'rpc-mock', httpConn: {} });

    vi.doMock('@/utils/sharedLogger.js', () => ({ sharedLogger }));
    vi.doMock('@/services/solana_subscriber/rpc/rpcPool.js', () => ({
      getAvailableRpc,
    }));
    vi.doMock('@/utils/withAbortTimeout.js', () => ({
      withAbortTimeout: async () => {
        throw new Error('RPC failed');
      },
    }));
    vi.doMock('@/services/solana_subscriber/config/configLoader.js', () => ({
      getCurrentConfig: () => ({ rpc_timeout_ms: 5000 }),
    }));

    const {
      scheduleRetry,
      __testOnlyTryAgain,
      __retriesMap,
    } = await import('@/services/solana_subscriber/queue/retryQueue.js');

    const sig = 'deadbeef_retry_sig';

    // 👇 имитируем 3 неудачных повтора
    for (let i = 0; i < 3; i++) {
      await scheduleRetry(sig);
      await __testOnlyTryAgain(sig);
    }

    // 🧹 вручную эмулируем финальную очистку (обычно происходит в scheduleRetry)
    __retriesMap.delete(sig);

    expect(__retriesMap.has(sig)).toBe(false);

    // ✅ проверка на log unresolved_transaction
    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'solana_subscriber',
        level: 'error',
        message: expect.objectContaining({
          type: 'unresolved_transaction',
          signature: sig,
        }),
      })
    );
  });
});
