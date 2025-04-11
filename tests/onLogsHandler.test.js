import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/solana_subscriber/rpc/rpcUtils.js', () => ({
  getParsedTransactionWithTimeout: vi.fn(),
}));

vi.mock('../services/solana_subscriber/utils/redisLogSender.js', () => ({
  redisPublishLog: vi.fn(),
}));

vi.mock('../services/solana_subscriber/db/subscriptions.js', () => ({
  updateLastSignature: vi.fn(),
}));

vi.mock('../services/solana_subscriber/queue/retryQueue.js', () => ({
  scheduleRetry: vi.fn(),
}));

vi.mock('../services/solana_subscriber/queue/redisRetryQueue.js', () => ({
  enqueueRedisRetry: vi.fn(),
}));

vi.mock('../utils/sharedLogger.js', () => ({
  sharedLogger: vi.fn(),
}));

vi.mock('../services/solana_subscriber/config/configLoader.js', () => ({
  getCurrentConfig: () => ({
    rpc_timeout_ms: 5000,
  }),
}));

import { getParsedTransactionWithTimeout } from '../services/solana_subscriber/rpc/rpcUtils.js';
import { redisPublishLog } from '../services/solana_subscriber/utils/redisLogSender.js';
import { updateLastSignature } from '../services/solana_subscriber/db/subscriptions.js';
import { scheduleRetry } from '../services/solana_subscriber/queue/retryQueue.js';
import { enqueueRedisRetry } from '../services/solana_subscriber/queue/redisRetryQueue.js';

import { handleLogEvent } from '../services/solana_subscriber/subscription/onLogsHandler.js';

const common = {
  chain_id: 'chain1',
  account: 'abc123',
  signature: 'sig001',
  subscription_type: 'regular',
  rpc: { id: 'rpc-1', limiter: { removeToken: () => true } },
};

describe('onLogsHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('успешно обрабатывает транзакцию', async () => {
    getParsedTransactionWithTimeout.mockResolvedValue({
      blockTime: 1710000000,
      meta: {},
    });

    await handleLogEvent(common);

    expect(redisPublishLog).toHaveBeenCalled();
    expect(updateLastSignature).toHaveBeenCalledWith('chain1', 'abc123', 'sig001');
    expect(enqueueRedisRetry).not.toHaveBeenCalled();
    expect(scheduleRetry).not.toHaveBeenCalled();
  });

  it('если Redis упал — идёт в redisRetryQueue', async () => {
    getParsedTransactionWithTimeout.mockResolvedValue({
      blockTime: 1710000000,
      meta: {},
    });

    redisPublishLog.mockRejectedValue(new Error('Redis down'));

    await handleLogEvent(common);

    expect(enqueueRedisRetry).toHaveBeenCalled();
    expect(updateLastSignature).not.toHaveBeenCalled();
  });

  it('если транзакция = null → retry', async () => {
    getParsedTransactionWithTimeout.mockResolvedValue(null);

    await handleLogEvent(common);

    expect(scheduleRetry).toHaveBeenCalledWith('sig001');
    expect(redisPublishLog).not.toHaveBeenCalled();
  });

  it('если meta.err → игнорирует', async () => {
    getParsedTransactionWithTimeout.mockResolvedValue({
      blockTime: 1710000000,
      meta: { err: 'SomeError' },
    });

    await handleLogEvent(common);

    expect(redisPublishLog).not.toHaveBeenCalled();
    expect(scheduleRetry).not.toHaveBeenCalled();
    expect(updateLastSignature).not.toHaveBeenCalled();
  });

  it('если лимитер не даёт токен → идёт в очередь', async () => {
    const rpc = { ...common.rpc, limiter: { removeToken: () => false } };
    await handleLogEvent({ ...common, rpc });

    expect(redisPublishLog).not.toHaveBeenCalled();
    expect(scheduleRetry).not.toHaveBeenCalled();
    expect(updateLastSignature).not.toHaveBeenCalled();
  });

  it('если blockTime отсутствует — использует Date.now()', async () => {
    const mockNow = 1720000000;
    vi.spyOn(Date, 'now').mockReturnValue(mockNow);

    getParsedTransactionWithTimeout.mockResolvedValue({
      blockTime: undefined,
      meta: {},
    });

    await handleLogEvent(common);

    const [, logArg] = redisPublishLog.mock.calls[0]; // Вытаскиваем второй аргумент
    expect(logArg.timestamp).toBe(mockNow);

    Date.now.mockRestore();
  });


  it('если subscription_type неизвестен — игнорирует', async () => {
    await handleLogEvent({
      ...common,
      subscription_type: 'something_weird',
    });

    expect(redisPublishLog).not.toHaveBeenCalled();
    expect(scheduleRetry).not.toHaveBeenCalled();
    expect(updateLastSignature).not.toHaveBeenCalled();
  });

  it('если subscription_type = spl_token — streamKey = solana_logs_spl', async () => {
    getParsedTransactionWithTimeout.mockResolvedValue({
      blockTime: 1711111111,
      meta: {},
    });

    await handleLogEvent({
      ...common,
      subscription_type: 'spl_token',
    });

    const [streamKey] = redisPublishLog.mock.calls[0];
    expect(streamKey).toBe('solana_logs_spl');
  });

});
