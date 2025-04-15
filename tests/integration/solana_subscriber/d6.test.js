import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleLogEvent } from '@/services/solana_subscriber/subscription/onLogsHandler.js';
import * as rpcUtils from '@/services/solana_subscriber/rpc/rpcUtils.js';
import * as retryQueue from '@/services/solana_subscriber/queue/retryQueue.js';
import * as sharedLogger from '@/utils/sharedLogger.js';

describe('D6: Исключение в onLogs → retry', () => {
  const dummyRpc = {
    id: 'rpc-1',
    limiter: { removeToken: () => true },
  };

  const event = {
    chain_id: 'chain1',
    account: 'someAccount',
    signature: 'deadbeefsig',
    subscription_type: 'regular',
    rpc: dummyRpc,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('должен вызвать scheduleRetry при исключении в getParsedTransactionWithTimeout', async () => {
    // 🧪 Мокаем зависимые функции
    vi.spyOn(rpcUtils, 'getParsedTransactionWithTimeout').mockImplementation(() => {
      throw new Error('Test exception inside getParsedTransactionWithTimeout');
    });

    const retrySpy = vi.spyOn(retryQueue, 'scheduleRetry').mockResolvedValue();
    const loggerSpy = vi.spyOn(sharedLogger, 'sharedLogger').mockResolvedValue();

    await handleLogEvent(event);

    expect(retrySpy).toHaveBeenCalledWith('deadbeefsig');
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'error',
        message: expect.objectContaining({
          type: 'log_event_exception',
          signature: 'deadbeefsig',
        }),
      })
    );
  });
});
