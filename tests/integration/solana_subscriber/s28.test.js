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

describe('S28: Все RPC недоступны → транзакция не обрабатывается', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    // Лимитер не пропускает запрос
    const rpc = {
      id: 'rpc-broken',
      limiter: { removeToken: () => false },
    };

    // Заменим функцию логгера
    vi.spyOn(sharedLogger, 'sharedLogger').mockResolvedValue();
    vi.spyOn(rpcUtils, 'getParsedTransactionWithTimeout').mockResolvedValue();
    vi.spyOn(redisSender, 'redisPublishLog').mockResolvedValue();
    vi.spyOn(subscriptions, 'updateLastSignature').mockResolvedValue();

    // Обертка, чтобы test мог переиспользовать этот rpc
    vi.stubGlobal('mockRpc', rpc);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('не вызывает обработку и логирует rate_limit', async () => {
    const rpc = global.mockRpc;

    await handleLogEvent({
      chain_id: 'chain-fail',
      account: 'acc-fail',
      signature: 'sig-nope',
      subscription_type: 'regular',
      rpc,
    });

    // Лимит блокирует
    expect(rpcUtils.getParsedTransactionWithTimeout).not.toHaveBeenCalled();
    expect(redisSender.redisPublishLog).not.toHaveBeenCalled();
    expect(subscriptions.updateLastSignature).not.toHaveBeenCalled();

    // Логируем ограничение
    expect(sharedLogger.sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warn',
        message: expect.objectContaining({
          event: 'rate_limit',
          signature: 'sig-nope',
          rpc_id: 'rpc-broken',
        }),
      })
    );
  });
});
