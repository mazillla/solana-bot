// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { recoverTransactions } from '@/services/solana_subscriber/subscription/recoveryManager.js';
import * as rpcUtils from '@/services/solana_subscriber/rpc/rpcUtils.js';
import * as rpcPool from '@/services/solana_subscriber/rpc/rpcPool.js';
import * as logSender from '@/services/solana_subscriber/utils/redisLogSender.js';
import * as db from '@/services/solana_subscriber/db/subscriptions.js';
import * as logger from '@/utils/sharedLogger.js';

describe('D13: recoverTransactions не обновляет last_signature при ошибке Redis', () => {
  it('останавливается и не вызывает updateLastSignature при ошибке публикации', async () => {
    const mockSignatures = [
      { signature: 'sig-1', slot: 1, confirmationStatus: 'confirmed' },
      { signature: 'sig-2', slot: 2, confirmationStatus: 'confirmed' },
    ];

    vi.spyOn(rpcUtils, 'getSignaturesForAddressWithTimeout')
      .mockResolvedValueOnce(mockSignatures)
      .mockResolvedValueOnce([]);

    vi.spyOn(rpcPool, 'getAvailableRpc').mockResolvedValue({ id: 'rpc-1' });

    vi.spyOn(rpcUtils, 'getParsedTransactionWithTimeout').mockResolvedValue({
      blockTime: Math.floor(Date.now() / 1000),
      meta: {},
      transaction: {},
    });

    const publishSpy = vi
      .spyOn(logSender, 'redisPublishLog')
      .mockImplementationOnce(() => Promise.resolve()) // первый успешный
      .mockImplementationOnce(() => Promise.reject(new Error('Redis down'))); // второй упал

    const updateSpy = vi.spyOn(db, 'updateLastSignature').mockResolvedValue();
    const loggerSpy = vi.spyOn(logger, 'sharedLogger').mockResolvedValue();

    await recoverTransactions({
      chain_id: 'test',
      account: 'acct',
      last_signature: 'sig-3',
      subscription_type: 'regular',
    });

    expect(publishSpy).toHaveBeenCalledTimes(2);
    expect(updateSpy).not.toHaveBeenCalled();

    // Проверим, что ошибка логировалась
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'solana_subscriber',
        level: 'error',
        message: expect.objectContaining({
          type: 'recovery_publish_failed',
          signature: 'sig-2',
        }),
      })
    );
  });
});
