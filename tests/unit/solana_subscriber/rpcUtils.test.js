import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/solana_subscriber/config/configLoader.js', () => ({
  getCurrentConfig: vi.fn(() => ({ rpc_timeout_ms: 100 })),
}));

vi.mock('@/utils/sharedLogger.js', () => ({
  sharedLogger: vi.fn(),
}));

import { getCurrentConfig } from '@/services/solana_subscriber/config/configLoader.js';
import { sharedLogger } from '@/utils/sharedLogger.js';
import {
  withTimeout,
  getParsedTransactionWithTimeout,
  getSignaturesForAddressWithTimeout,
} from '@/services/solana_subscriber/rpc/rpcUtils.js';

describe('rpcUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentConfig.mockReturnValue({ rpc_timeout_ms: 100 });
  });

  describe('withTimeout', () => {
    it('успешно возвращает результат, если промис успевает', async () => {
      const result = await withTimeout(Promise.resolve('ok'), 100);
      expect(result).toBe('ok');
    });

    it('отклоняет, если промис не успевает', async () => {
      await expect(
        withTimeout(new Promise((res) => setTimeout(res, 200)), 50)
      ).rejects.toThrow(/RPC timeout/);
    });

    it('отклоняет оригинальную ошибку, если промис сам бросает исключение', async () => {
      const failingPromise = Promise.reject(new Error('Something went wrong'));
      await expect(withTimeout(failingPromise, 100)).rejects.toThrow('Something went wrong');
    });
  });

  describe('getParsedTransactionWithTimeout', () => {
    const rpc = {
      id: 'rpc-1',
      httpConn: {
        getParsedTransaction: vi.fn(),
      },
    };

    it('возвращает результат при успехе', async () => {
      rpc.httpConn.getParsedTransaction.mockResolvedValue({ tx: 'parsed' });

      const result = await getParsedTransactionWithTimeout(rpc, 'sig123');
      expect(result).toEqual({ tx: 'parsed' });
    });

    it('возвращает null и логирует при таймауте', async () => {
      rpc.httpConn.getParsedTransaction.mockImplementation(
        () => new Promise((res) => setTimeout(res, 200))
      );

      const result = await getParsedTransactionWithTimeout(rpc, 'sig456');
      expect(result).toBeNull();
      expect(sharedLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warn',
          message: expect.objectContaining({
            type: 'rpc_timeout',
            method: 'getParsedTransaction',
            signature: 'sig456',
          }),
        })
      );
    });

    it('использует значение по умолчанию 5000мс, если rpc_timeout_ms отсутствует', async () => {
      getCurrentConfig.mockReturnValue({});
      rpc.httpConn.getParsedTransaction.mockResolvedValue({ ok: true });

      const result = await getParsedTransactionWithTimeout(rpc, 'sig789');
      expect(result).toEqual({ ok: true });
    });
  });

  describe('getSignaturesForAddressWithTimeout', () => {
    const rpc = {
      id: 'rpc-2',
      httpConn: {
        getSignaturesForAddress: vi.fn(),
      },
    };

    it('возвращает результат при успехе', async () => {
      rpc.httpConn.getSignaturesForAddress.mockResolvedValue(['sig1', 'sig2']);

      const result = await getSignaturesForAddressWithTimeout(rpc, 'some-address');
      expect(result).toEqual(['sig1', 'sig2']);
    });

    it('возвращает null и логирует при таймауте', async () => {
      rpc.httpConn.getSignaturesForAddress.mockImplementation(
        () => new Promise((res) => setTimeout(res, 200))
      );

      const result = await getSignaturesForAddressWithTimeout(rpc, {
        toBase58: () => 'base58-address',
      });

      expect(result).toBeNull();
      expect(sharedLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warn',
          message: expect.objectContaining({
            method: 'getSignaturesForAddress',
            address: 'base58-address',
          }),
        })
      );
    });

    it('если toBase58 отсутствует — логирует address как строку', async () => {
      rpc.httpConn.getSignaturesForAddress.mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('fail')), 110))
      );

      const result = await getSignaturesForAddressWithTimeout(rpc, 'simple-address');
      expect(result).toBeNull();
      expect(sharedLogger).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warn',
          message: expect.objectContaining({
            address: 'simple-address',
          }),
        })
      );
    });

    it('использует значение по умолчанию 5000мс, если rpc_timeout_ms отсутствует', async () => {
      getCurrentConfig.mockReturnValue({});
      rpc.httpConn.getSignaturesForAddress.mockResolvedValue(['x']);

      const result = await getSignaturesForAddressWithTimeout(rpc, 'some-address');
      expect(result).toEqual(['x']);
    });
  });
});
