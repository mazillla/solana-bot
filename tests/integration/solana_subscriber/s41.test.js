import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleLogEvent } from '@/services/solana_subscriber/subscription/onLogsHandler.js';
import * as rpcUtils from '@/services/solana_subscriber/rpc/rpcUtils.js';
import * as retryQueue from '@/services/solana_subscriber/queue/retryQueue.js';
import { getCurrentConfig } from '@/services/solana_subscriber/config/configLoader.js';

vi.mock('@/services/solana_subscriber/config/configLoader.js', () => ({
  getCurrentConfig: vi.fn(() => ({ rpc_timeout_ms: 5000 })),
}));

describe('S41: Таймаут при получении транзакции — вызывается retry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    // таймаут или пустой результат
    vi.spyOn(rpcUtils, 'getParsedTransactionWithTimeout').mockResolvedValue(null);
    vi.spyOn(retryQueue, 'scheduleRetry').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('при null от getParsedTransaction вызывает scheduleRetry', async () => {
    const rpc = {
      id: 'rpc-timed-out',
      limiter: { removeToken: () => true },
    };

    await handleLogEvent({
      chain_id: 'chain-timeout',
      account: 'acc-timeout',
      signature: 'sig-timeout',
      subscription_type: 'regular',
      rpc,
    });

    expect(retryQueue.scheduleRetry).toHaveBeenCalledWith('sig-timeout');
  });
});
