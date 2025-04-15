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

describe('S34: sharedLogger содержит chain_id, signature, rpc_id', () => {
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

  it('в логе есть chain_id, signature, rpc_id', async () => {
    const rpc = {
      id: 'rpc-log-test',
      limiter: { removeToken: () => true },
    };

    await handleLogEvent({
      chain_id: 'chain-test',
      account: 'acc-test',
      signature: 'sig-xyz',
      subscription_type: 'regular',
      rpc,
    });

    const logCall = sharedLogger.sharedLogger.mock.calls.find(
      ([arg]) =>
        arg?.message?.type === 'transaction_dispatched' &&
        arg?.level === 'info'
    );

    expect(logCall).toBeDefined();
    const { message } = logCall[0];

    expect(message).toMatchObject({
      chain_id: 'chain-test',
      signature: 'sig-xyz',
      rpc_id: 'rpc-log-test',
    });
  });
});
