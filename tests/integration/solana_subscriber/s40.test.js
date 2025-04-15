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

describe('S40: Медленный Redis — система стабильна', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(rpcUtils, 'getParsedTransactionWithTimeout').mockResolvedValue({
      meta: null,
      blockTime: 1234567890,
    });

    vi.spyOn(redisSender, 'redisPublishLog').mockImplementation(async () => {
      await new Promise(r => setTimeout(r, 2000)); // симулируем задержку
    });

    vi.spyOn(subscriptions, 'updateLastSignature').mockResolvedValue();
    vi.spyOn(sharedLogger, 'sharedLogger').mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('не падает при медленном redisPublishLog', async () => {
    const rpc = {
      id: 'rpc-slow',
      limiter: { removeToken: () => true },
    };

    const start = Date.now();
    await handleLogEvent({
      chain_id: 'cX',
      account: 'accX',
      signature: 'sigX',
      subscription_type: 'regular',
      rpc,
    });
    const duration = Date.now() - start;

    expect(duration).toBeGreaterThanOrEqual(1900); // подтвердим, что ждали
    expect(redisSender.redisPublishLog).toHaveBeenCalled();
    expect(sharedLogger.sharedLogger).toHaveBeenCalled();
  });
});
