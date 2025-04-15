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

describe('S14: Лог с ошибкой (meta.err) игнорируется', () => {
  beforeEach(() => {
    vi.spyOn(rpcUtils, 'getParsedTransactionWithTimeout').mockResolvedValue({
      meta: { err: { message: "Transaction error" } },
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

  it('должен проигнорировать лог с ошибкой и не вызывать отправку в Redis и обновление сигнатуры', async () => {
    const params = {
      chain_id: 'test-chain',
      account: 'test-account',
      signature: 'error-signature',
      subscription_type: 'regular',
      rpc: { id: 'test-rpc', limiter: { removeToken: () => true } },
    };

    await handleLogEvent(params);

    expect(rpcUtils.getParsedTransactionWithTimeout).toHaveBeenCalledWith(params.rpc, 'error-signature');
    
    expect(redisSender.redisPublishLog).not.toHaveBeenCalled();
    expect(subscriptions.updateLastSignature).not.toHaveBeenCalled();

    expect(sharedLogger.sharedLogger).toHaveBeenCalledWith({
      service: 'solana_subscriber',
      level: 'warn',
      message: {
        type: 'failed_transaction',
        signature: 'error-signature',
        error: { message: "Transaction error" },
      },
    });
  });
});
