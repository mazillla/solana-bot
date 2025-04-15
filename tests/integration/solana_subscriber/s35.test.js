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

describe('S35: Ошибки логируются с level: error', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(rpcUtils, 'getParsedTransactionWithTimeout').mockResolvedValue({
      meta: null,
      blockTime: 1234567890,
    });

    vi.spyOn(redisSender, 'redisPublishLog').mockRejectedValue(new Error('Redis write failed'));
    vi.spyOn(subscriptions, 'updateLastSignature').mockResolvedValue();
    vi.spyOn(sharedLogger, 'sharedLogger').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('логирует ошибку с level: error при сбое Redis', async () => {
    const rpc = {
      id: 'rpc-x',
      limiter: { removeToken: () => true },
    };

    await handleLogEvent({
      chain_id: 'c1',
      account: 'acc1',
      signature: 'sig-error',
      subscription_type: 'regular',
      rpc,
    });

    const errorLog = sharedLogger.sharedLogger.mock.calls.find(
      ([log]) =>
        log?.message?.type === 'redis_publish_failed' &&
        log?.level === 'error'
    );

    expect(errorLog).toBeDefined();
    expect(errorLog[0].message).toMatchObject({
      signature: 'sig-error',
      error: 'Redis write failed',
    });
  });
});
