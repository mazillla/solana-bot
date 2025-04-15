import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleLogEvent } from '@/services/solana_subscriber/subscription/onLogsHandler.js';
import * as rpcUtils from '@/services/solana_subscriber/rpc/rpcUtils.js';
import * as redisSender from '@/services/solana_subscriber/utils/redisLogSender.js';
import * as subscriptions from '@/services/solana_subscriber/db/subscriptions.js';
import * as sharedLogger from '@/utils/sharedLogger.js';
import { getCurrentConfig } from '@/services/solana_subscriber/config/configLoader.js';

vi.mock('@/services/solana_subscriber/config/configLoader.js', () => ({
  getCurrentConfig: vi.fn(),
}));

describe('S13: Валидный лог успешно обрабатывается', () => {
  beforeEach(() => {
    vi.spyOn(rpcUtils, 'getParsedTransactionWithTimeout').mockResolvedValue({
      meta: { err: null },
      blockTime: 1234567890,
    });

    vi.spyOn(redisSender, 'redisPublishLog').mockResolvedValue();
    vi.spyOn(subscriptions, 'updateLastSignature').mockResolvedValue();
    vi.spyOn(sharedLogger, 'sharedLogger').mockResolvedValue();
    getCurrentConfig.mockReturnValue({ rpc_timeout_ms: 5000 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('должен успешно обработать лог и вызвать все функции', async () => {
    const params = {
      chain_id: 'test-chain',
      account: 'test-account',
      signature: 'valid-signature',
      subscription_type: 'regular',
      rpc: { id: 'test-rpc', limiter: { removeToken: () => true } },
    };

    await handleLogEvent(params);

    expect(rpcUtils.getParsedTransactionWithTimeout).toHaveBeenCalledWith(params.rpc, 'valid-signature');
    
    expect(redisSender.redisPublishLog).toHaveBeenCalledWith('solana_logs_regular', {
      chain_id: 'test-chain',
      account: 'test-account',
      signature: 'valid-signature',
      log: expect.any(Object),
      subscription_type: 'regular',
      blockTime: 1234567890,
      timestamp: 1234567890000,
    });

    expect(subscriptions.updateLastSignature).toHaveBeenCalledWith('test-chain', 'test-account', 'valid-signature');

    expect(sharedLogger.sharedLogger).toHaveBeenCalledWith({
      service: 'solana_subscriber',
      level: 'info',
      message: {
        type: 'transaction_dispatched',
        stream: 'solana_logs_regular',
        signature: 'valid-signature',
        chain_id: 'test-chain',
        rpc_id: 'test-rpc',
      },
    });
  });
});
