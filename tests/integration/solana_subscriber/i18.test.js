// tests/integration/solana_subscriber/i18.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('i18 — зависание внутри handleLogEvent не вешает процесс', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('если getParsedTransaction завис — scheduleRetry вызывается, процесс не виснет', async () => {
    const sharedLogger = vi.fn();
    const scheduleRetry = vi.fn();

    // имитируем таймаут (withAbortTimeout его пробрасывает как ошибку)
    const getParsedTransactionWithTimeout = vi.fn().mockRejectedValue(new Error('Timeout'));

    const mockRpc = {
      id: 'rpc-timeout',
      limiter: { removeToken: () => true },
    };

    vi.doMock('@/utils/sharedLogger.js', () => ({ sharedLogger }));
    vi.doMock('@/services/solana_subscriber/queue/retryQueue.js', () => ({ scheduleRetry }));
    vi.doMock('@/services/solana_subscriber/rpc/rpcUtils.js', () => ({
      getParsedTransactionWithTimeout,
    }));
    vi.doMock('@/services/solana_subscriber/config/configLoader.js', () => ({
      getCurrentConfig: () => ({ rpc_timeout_ms: 2000 }),
    }));

    const { handleLogEvent } = await import('@/services/solana_subscriber/subscription/onLogsHandler.js');

    await handleLogEvent({
      chain_id: 'zzz',
      account: 'hungAcc',
      signature: 'sig-hang',
      subscription_type: 'regular',
      rpc: mockRpc,
    });

    expect(scheduleRetry).toHaveBeenCalledWith('sig-hang');

    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          type: 'log_event_exception',
          signature: 'sig-hang',
        }),
      })
    );
  });
});
