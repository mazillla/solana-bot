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

describe('S36: sharedLogger может упасть, но сервис продолжает работать', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(rpcUtils, 'getParsedTransactionWithTimeout').mockResolvedValue({
      meta: null,
      blockTime: 1234567890,
    });

    vi.spyOn(redisSender, 'redisPublishLog').mockResolvedValue();
    vi.spyOn(subscriptions, 'updateLastSignature').mockResolvedValue();

    // 💣 Искусственно ломаем логгер
    vi.spyOn(sharedLogger, 'sharedLogger').mockImplementation(() => {
      throw new Error('logger failed');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('не выбрасывает исключение, если sharedLogger падает', async () => {
    const rpc = {
      id: 'rpc-log-break',
      limiter: { removeToken: () => true },
    };

    // должен выполниться без throw
    let caught = false;
    try {
      await handleLogEvent({
        chain_id: 'chain-logger',
        account: 'acc-logger',
        signature: 'sig-logger',
        subscription_type: 'regular',
        rpc,
      });
    } catch (err) {
      caught = true;
    }

    expect(caught).toBe(false);

    expect(redisSender.redisPublishLog).toHaveBeenCalled();
    expect(subscriptions.updateLastSignature).toHaveBeenCalled();
  });
});
