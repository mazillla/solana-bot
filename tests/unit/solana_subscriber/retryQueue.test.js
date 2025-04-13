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

// Импорты моков для обращения
import { getAvailableRpc } from '@/services/solana_subscriber/rpc/rpcPool.js';
import { getParsedTransactionWithTimeout } from '@/services/solana_subscriber/rpc/rpcUtils.js';
import { redisPublishLog } from '@/services/solana_subscriber/utils/redisLogSender.js';
import { updateLastSignature } from '@/services/solana_subscriber/db/subscriptions.js';
import { sharedLogger } from '@/utils/sharedLogger.js';

describe('retryQueue', () => {
  let tryAgain;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/services/solana_subscriber/queue/retryQueue.js');
    tryAgain = mod.__testOnlyTryAgain;
  });

  it(
    'повторяет максимум 3 раза и логирует как нерешённую',
    async () => {
      getAvailableRpc.mockResolvedValue({ id: 'rpc-test', httpConn: {} });
      getParsedTransactionWithTimeout.mockResolvedValue(null);

      await tryAgain('tx-123');
      await new Promise((r) => setTimeout(r, 7500)); // 1s + 2s + 4s = 7s

      expect(getParsedTransactionWithTimeout).toHaveBeenCalledTimes(4);

      expect(sharedLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({
            type: 'unresolved_transaction',
            signature: 'tx-123',
          }),
        })
      );
    },
    15000
  );

  it(
    'если retry проходит успешно — публикует и обновляет',
    async () => {
      getAvailableRpc.mockResolvedValue({ id: 'rpc-ok', httpConn: {} });
      getParsedTransactionWithTimeout.mockResolvedValue({
        meta: {},
        blockTime: 1710000000,
      });

      await tryAgain('tx-ok');
      await new Promise((r) => setTimeout(r, 100)); // немного подождать

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

  it(
    'если redisPublishLog выбрасывает ошибку — будет повтор',
    async () => {
      getAvailableRpc.mockResolvedValue({ id: 'rpc-fail', httpConn: {} });

      getParsedTransactionWithTimeout.mockResolvedValue({
        meta: {},
        blockTime: 1710000000,
      });

      redisPublishLog.mockRejectedValue(new Error('fail'));

      await tryAgain('tx-fail');
      await new Promise((r) => setTimeout(r, 1500)); // ждём повтора

      expect(getParsedTransactionWithTimeout).toHaveBeenCalledTimes(2);

      expect(sharedLogger).not.toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.objectContaining({
            type: 'retried_transaction_success',
          }),
        })
      );
    },
    5000
  );

  it(
    'если tryAgain выбрасывает необработанную ошибку — логируется как retry_unhandled_error',
    async () => {
      const mod = await import('@/services/solana_subscriber/queue/retryQueue.js');

      // Мокаем getAvailableRpc чтобы бросить ошибку
      getAvailableRpc.mockImplementation(() => {
        throw new Error('forced fail');
      });

      await mod.scheduleRetry('tx-throw');
      await new Promise((r) => setTimeout(r, 1100));

      expect(sharedLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'error',
          message: expect.objectContaining({
            type: 'retry_unhandled_error',
            signature: 'tx-throw',
            error: 'forced fail',
          }),
        })
      );
    },
    3000
  );

  it(
    'если нет доступных RPC — логируется как no_available_rpc и повторяется',
    async () => {
      const mod = await import('@/services/solana_subscriber/queue/retryQueue.js');

      getAvailableRpc.mockResolvedValue(null); // нет RPC

      await mod.scheduleRetry('tx-norpc');
      await new Promise((r) => setTimeout(r, 1100));

      expect(sharedLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug',
          message: expect.objectContaining({
            type: 'no_available_rpc',
            signature: 'tx-norpc',
          }),
        })
      );
    },
    3000
  );

  it(
    'если blockTime отсутствует — используется Date.now()',
    async () => {
      getAvailableRpc.mockResolvedValue({ id: 'rpc-noblock', httpConn: {} });

      getParsedTransactionWithTimeout.mockResolvedValue({
        meta: {},
        blockTime: null, // <- имитируем отсутствие blockTime
      });

      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const mod = await import('@/services/solana_subscriber/queue/retryQueue.js');
      await mod.__testOnlyTryAgain('tx-noblock');

      expect(redisPublishLog).toHaveBeenCalledWith(
        'solana_logs_regular',
        expect.objectContaining({
          timestamp: now,
        })
      );

      Date.now.mockRestore();
    },
    3000
  );

});
