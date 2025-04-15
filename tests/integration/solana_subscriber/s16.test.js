import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleLogEvent } from '@/services/solana_subscriber/subscription/onLogsHandler.js';
import * as rpcUtils from '@/services/solana_subscriber/rpc/rpcUtils.js';
import * as retryQueue from '@/services/solana_subscriber/queue/retryQueue.js';
import * as redisSender from '@/services/solana_subscriber/utils/redisLogSender.js';
import * as subscriptions from '@/services/solana_subscriber/db/subscriptions.js';
import * as sharedLogger from '@/utils/sharedLogger.js';
import { getCurrentConfig } from '@/services/solana_subscriber/config/configLoader.js';

vi.mock('@/services/solana_subscriber/config/configLoader.js', () => ({
  getCurrentConfig: vi.fn(),
}));

describe('S16: Лог с неподдерживаемым типом подписки игнорируется', () => {
  beforeEach(() => {
    vi.spyOn(rpcUtils, 'getParsedTransactionWithTimeout').mockResolvedValue(null);
    vi.spyOn(retryQueue, 'scheduleRetry').mockResolvedValue();
    vi.spyOn(redisSender, 'redisPublishLog').mockResolvedValue();
    vi.spyOn(subscriptions, 'updateLastSignature').mockResolvedValue();
    vi.spyOn(sharedLogger, 'sharedLogger').mockResolvedValue();
    getCurrentConfig.mockReturnValue({ rpc_timeout_ms: 5000 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('должен проигнорировать лог с неизвестным типом подписки и ничего не вызывать', async () => {
    const params = {
      chain_id: 'test-chain',
      account: 'test-account',
      signature: 'unknown-signature',
      subscription_type: 'invalid_type',  // неизвестный тип
      rpc: { id: 'test-rpc', limiter: { removeToken: () => true } },
    };

    await handleLogEvent(params);

    expect(rpcUtils.getParsedTransactionWithTimeout).not.toHaveBeenCalled();
    expect(retryQueue.scheduleRetry).not.toHaveBeenCalled();
    expect(redisSender.redisPublishLog).not.toHaveBeenCalled();
    expect(subscriptions.updateLastSignature).not.toHaveBeenCalled();

    // Проверим, что логгер предупреждения вызван (если реализовано улучшение)
    expect(sharedLogger.sharedLogger).toHaveBeenCalledWith({
      service: 'solana_subscriber',
      level: 'warn',
      message: {
        type: 'unsupported_subscription_type',
        subscription_type: 'invalid_type',
        chain_id: 'test-chain',
        account: 'test-account',
        signature: 'unknown-signature',
      },
    });
  });
});
