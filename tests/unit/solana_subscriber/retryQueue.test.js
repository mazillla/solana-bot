import { describe, it, expect, vi, beforeEach } from 'vitest';

// 🧨 Все моки — ДО любых импортов
vi.mock('redis', () => ({
  createClient: vi.fn(() => ({
    connect: vi.fn(),
    xAdd: vi.fn(),
    quit: vi.fn(),
  })),
}));

vi.mock('@/utils/sharedLogger.js', () => ({
  sharedLogger: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/config/configLoader.js', () => ({
  getCurrentConfig: () => ({
    rpc_timeout_ms: 100,
  }),
}));

vi.mock('@/services/solana_subscriber/rpc/rpcPool.js', () => ({
  getAvailableRpc: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/rpc/rpcUtils.js', () => ({
  getParsedTransactionWithTimeout: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/utils/redisLogSender.js', () => ({
  redisPublishLog: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/db/subscriptions.js', () => ({
  updateLastSignature: vi.fn(),
}));

// Импорты моков
import { getAvailableRpc } from '@/services/solana_subscriber/rpc/rpcPool.js';
import { getParsedTransactionWithTimeout } from '@/services/solana_subscriber/rpc/rpcUtils.js';
import { redisPublishLog } from '@/services/solana_subscriber/utils/redisLogSender.js';
import { updateLastSignature } from '@/services/solana_subscriber/db/subscriptions.js';
import { sharedLogger } from '@/utils/sharedLogger.js';

describe('retryQueue (реальный таймер, без фейков)', () => {
  let tryAgain;
  let scheduleRetry;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/services/solana_subscriber/queue/retryQueue.js');
    tryAgain = mod.__testOnlyTryAgain;
    scheduleRetry = mod.scheduleRetry;
  });

  it(
    'повторяет максимум 3 раза и логирует как нерешённую',
    async () => {
      getAvailableRpc.mockResolvedValue({ id: 'rpc-test', httpConn: {} });
      getParsedTransactionWithTimeout.mockResolvedValue(null);

      await tryAgain('tx-123');
      await new Promise((r) => setTimeout(r, 7500));

      expect(sharedLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({
            type: 'unresolved_transaction',
            signature: 'tx-123',
          }),
        })
      );
    },
    10000
  );

  it(
    'при успешном retry логирует успех',
    async () => {
      getAvailableRpc.mockResolvedValue({
        id: 'rpc-ok',
        httpConn: {
          getParsedTransaction: vi.fn().mockResolvedValue({
            meta: {},
            blockTime: 1710000000,
          }),
        },
      });
  
      await tryAgain('tx-ok');
  
      await new Promise((r) => setTimeout(r, 1000));
  
      console.log('📦 redisPublishLog calls:', redisPublishLog.mock.calls.length);
  
      expect(redisPublishLog).toHaveBeenCalled();
      expect(updateLastSignature).toHaveBeenCalled();
      expect(sharedLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({
            type: 'retried_transaction_success',
            signature: 'tx-ok',
          }),
        })
      );
    },
    3000
  );
  
});
