import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/sharedLogger.js', () => ({
  sharedLogger: vi.fn(),
}));

vi.mock('@/utils/withAbortTimeout.js', () => ({
  withAbortTimeout: vi.fn((fn) => fn()),
}));

vi.mock('@/services/solana_subscriber/config/configLoader.js', () => ({
  getCurrentConfig: () => ({
    rpc_timeout_ms: 5000,
  }),
}));

describe('rpcUtils', () => {
  let rpcUtils;
  let rpc;

  beforeEach(async () => {
    vi.clearAllMocks();
    rpcUtils = await import('@/services/solana_subscriber/rpc/rpcUtils.js');

    rpc = {
      id: 'rpc-test',
      httpConn: {
        getParsedTransaction: vi.fn(),
        getSignaturesForAddress: vi.fn(),
      },
    };
  });

  it('возвращает parsed transaction при успехе', async () => {
    const parsed = { meta: {}, slot: 123 };
    rpc.httpConn.getParsedTransaction.mockResolvedValue(parsed);

    const result = await rpcUtils.getParsedTransactionWithTimeout(rpc, 'sig-1');

    expect(result).toBe(parsed);
  });

  it('логирует и возвращает null при ошибке getParsedTransaction', async () => {
    const { sharedLogger } = await import('@/utils/sharedLogger.js');
    const { withAbortTimeout } = await import('@/utils/withAbortTimeout.js');

    withAbortTimeout.mockImplementationOnce(() => {
      throw new Error('timeout');
    });

    const result = await rpcUtils.getParsedTransactionWithTimeout(rpc, 'sig-fail');
    expect(result).toBe(null);

    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          type: 'rpc_timeout',
          method: 'getParsedTransaction',
          signature: 'sig-fail',
        }),
      })
    );
  });

  it('возвращает сигнатуры при успехе getSignaturesForAddress', async () => {
    const sigs = [{ signature: 'abc', slot: 111 }];
    rpc.httpConn.getSignaturesForAddress.mockResolvedValue(sigs);

    const result = await rpcUtils.getSignaturesForAddressWithTimeout(rpc, 'addr-1');
    expect(result).toBe(sigs);
  });

  it('логирует и возвращает null при ошибке getSignaturesForAddress', async () => {
    const { sharedLogger } = await import('@/utils/sharedLogger.js');
    const { withAbortTimeout } = await import('@/utils/withAbortTimeout.js');

    withAbortTimeout.mockImplementationOnce(() => {
      throw new Error('timeout');
    });

    const result = await rpcUtils.getSignaturesForAddressWithTimeout(rpc, 'addr-fail');
    expect(result).toBe(null);

    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.objectContaining({
          type: 'rpc_timeout',
          method: 'getSignaturesForAddress',
          address: 'addr-fail',
        }),
      })
    );
  });
});
