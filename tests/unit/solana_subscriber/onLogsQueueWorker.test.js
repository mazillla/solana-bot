// tests/unit/onLogsQueueWorker.test.js
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { __processOneQueueItem } from '@/services/solana_subscriber/queue/onLogsQueueWorker.js';

vi.mock('@/services/solana_subscriber/queue/onLogsQueue.js', () => ({
  dequeueSignature: vi.fn(() => 'mockedSig'),
  getQueueLength: vi.fn(() => 1),
  enqueueSignature: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/rpc/rpcPool.js', () => ({
  getAvailableRpc: vi.fn(() => ({
    id: 'rpc-1',
    httpConn: {},
  })),
}));

vi.mock('@/services/solana_subscriber/rpc/rpcUtils.js', () => ({
  getParsedTransactionWithTimeout: vi.fn(() => ({
    blockTime: 1710000000,
    meta: { err: null },
  })),
}));

vi.mock('@/services/solana_subscriber/utils/redisLogSender.js', () => ({
  redisPublishLog: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/db/subscriptions.js', () => ({
  updateLastSignature: vi.fn(),
}));

vi.mock('@/utils/sharedLogger.js', () => ({
  sharedLogger: vi.fn(),
}));

describe('onLogsQueueWorker::__processOneQueueItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('должен обрабатывать сигнатуру и логировать успех', async () => {
    await __processOneQueueItem({
      chain_id: 'test-chain',
      account: 'test-account',
      subscription_type: 'regular',
    });

    const { redisPublishLog } = await import('@/services/solana_subscriber/utils/redisLogSender.js');
    const { updateLastSignature } = await import('@/services/solana_subscriber/db/subscriptions.js');

    expect(redisPublishLog).toHaveBeenCalled();
    expect(updateLastSignature).toHaveBeenCalledWith('test-chain', 'test-account', 'mockedSig');
  });
});
