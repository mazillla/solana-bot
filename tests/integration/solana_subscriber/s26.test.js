import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleLogEvent } from '@/services/solana_subscriber/subscription/onLogsHandler.js';
import * as rpcUtils from '@/services/solana_subscriber/rpc/rpcUtils.js';
import * as redisSender from '@/services/solana_subscriber/utils/redisLogSender.js';
import * as subscriptions from '@/services/solana_subscriber/db/subscriptions.js';
import * as sharedLogger from '@/utils/sharedLogger.js';
import { getCurrentConfig } from '@/services/solana_subscriber/config/configLoader.js';

vi.mock('@/services/solana_subscriber/config/configLoader.js', () => ({
  getCurrentConfig: vi.fn(() => ({ rpc_timeout_ms: 5000 })),
}));

describe('S26: RPC успешно обрабатывает транзакцию', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(rpcUtils, 'getParsedTransactionWithTimeout').mockResolvedValue({
      meta: null,
      blockTime: 1234567890,
    });

    vi.spyOn(redisSender, 'redisPublishLog').mockResolvedValue();
    vi.spyOn(subscriptions, 'updateLastSignature').mockResolvedValue();
    vi.spyOn(sharedLogger, 'sharedLogger').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('обрабатывает лог и публикует транзакцию', async () => {
    const rpc = {
      id: 'rpc-success',
      limiter: { removeToken: () => true },
    };

    await handleLogEvent({
      chain_id: 'chain-success',
      account: 'acc-success',
      signature: 'sig-ok',
      subscription_type: 'regular',
      rpc,
    });

    expect(rpcUtils.getParsedTransactionWithTimeout).toHaveBeenCalledWith(rpc, 'sig-ok');

    expect(redisSender.redisPublishLog).toHaveBeenCalledWith(
      'solana_logs_regular',
      expect.objectContaining({
        chain_id: 'chain-success',
        account: 'acc-success',
        signature: 'sig-ok',
      })
    );

    expect(subscriptions.updateLastSignature).toHaveBeenCalledWith(
      'chain-success',
      'acc-success',
      'sig-ok'
    );

    expect(sharedLogger.sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'info',
        message: expect.objectContaining({
          type: 'transaction_dispatched',
          stream: 'solana_logs_regular',
          rpc_id: 'rpc-success',
        }),
      })
    );
  });
});
