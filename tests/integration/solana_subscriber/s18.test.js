// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { recoverTransactions } from '@/services/solana_subscriber/subscription/recoveryManager.js';
import * as rpcPool from '@/services/solana_subscriber/rpc/rpcPool.js';
import * as rpcUtils from '@/services/solana_subscriber/rpc/rpcUtils.js';
import * as redisSender from '@/services/solana_subscriber/utils/redisLogSender.js';
import * as subscriptions from '@/services/solana_subscriber/db/subscriptions.js';
import * as sharedLogger from '@/utils/sharedLogger.js';

describe('S18: Восстановление missed логов', () => {
  it('восстанавливает и публикует валидные транзакции', async () => {
    const mockSignatures = [
      { signature: 'sig-1', slot: 1, confirmationStatus: 'confirmed' },
      { signature: 'sig-2', slot: 2, confirmationStatus: 'confirmed' },
    ];

    vi.spyOn(rpcUtils, 'getSignaturesForAddressWithTimeout')
      .mockResolvedValueOnce(mockSignatures)
      .mockResolvedValueOnce([]);

    vi.spyOn(rpcPool, 'getAvailableRpc').mockResolvedValue({ id: 'rpc-1' });

    vi.spyOn(rpcUtils, 'getParsedTransactionWithTimeout')
      .mockResolvedValueOnce(null) // sig-1 пропускается
      .mockResolvedValueOnce({
        blockTime: Math.floor(Date.now() / 1000),
        meta: {},
        transaction: {},
      }); // sig-2 — валидная

    vi.spyOn(redisSender, 'redisPublishLog').mockResolvedValue();

    const updateSigSpy = vi.spyOn(subscriptions, 'updateLastSignature').mockResolvedValue();
    const loggerSpy = vi.spyOn(sharedLogger, 'sharedLogger').mockResolvedValue();

    await recoverTransactions({
      chain_id: 'chain-id',
      account: 'acct',
      last_signature: 'sig-final',
      subscription_type: 'regular',
    });

    expect(rpcUtils.getParsedTransactionWithTimeout).toHaveBeenCalledTimes(2);
    expect(redisSender.redisPublishLog).toHaveBeenCalledTimes(1);

    // ✅ Исправлено: проверяем, что обновление происходит только для валидной транзакции
    expect(updateSigSpy).toHaveBeenCalledTimes(1);
    expect(updateSigSpy).toHaveBeenCalledWith('chain-id', 'acct', 'sig-2');

    expect(loggerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'solana_subscriber',
        level: 'info',
        message: expect.objectContaining({
          type: 'recovery_completed',
          recovered_count: 1,
        }),
      })
    );
  });
});
