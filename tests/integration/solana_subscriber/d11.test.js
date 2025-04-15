// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { recoverTransactions } from '@/services/solana_subscriber/subscription/recoveryManager.js';
import * as rpcUtils from '@/services/solana_subscriber/rpc/rpcUtils.js';
import * as rpcPool from '@/services/solana_subscriber/rpc/rpcPool.js';
import * as logSender from '@/services/solana_subscriber/utils/redisLogSender.js';
import * as db from '@/services/solana_subscriber/db/subscriptions.js';

describe('D11: recoverTransactions обрабатывает всё до last_signature и обновляет её один раз', () => {
  it('обрабатывает сигнатуры несколькими батчами и обновляет только последнюю', async () => {
    const allSignatures = [];

    // создаём 1500 сигнатур
    for (let i = 0; i < 1500; i++) {
      allSignatures.push({
        signature: `sig-${i}`,
        slot: i,
        confirmationStatus: 'confirmed',
      });
    }

    // Мокаем последовательные вызовы getSignatures (2 батча по 1000 + 500)
    const getSignaturesSpy = vi
      .spyOn(rpcUtils, 'getSignaturesForAddressWithTimeout')
      .mockImplementationOnce(() => Promise.resolve(allSignatures.slice(0, 1000)))
      .mockImplementationOnce(() => Promise.resolve(allSignatures.slice(1000, 1500)))
      .mockImplementationOnce(() => Promise.resolve([]));

    // Мокаем RPC
    vi.spyOn(rpcPool, 'getAvailableRpc').mockResolvedValue({
      id: 'mock-rpc',
    });

    // Все транзакции успешно парсятся
    vi.spyOn(rpcUtils, 'getParsedTransactionWithTimeout').mockImplementation((_, signature) =>
      Promise.resolve({
        blockTime: Math.floor(Date.now() / 1000),
        meta: {},
        transaction: {},
        signature,
      })
    );

    const publishSpy = vi.spyOn(logSender, 'redisPublishLog').mockResolvedValue();
    const updateSigSpy = vi.spyOn(db, 'updateLastSignature').mockResolvedValue();

    await recoverTransactions({
      chain_id: 'chain-test',
      account: 'account-test',
      last_signature: 'sig-1500',
      subscription_type: 'regular',
    });

    // Должны обработать все 1500 сигнатур
    expect(publishSpy).toHaveBeenCalledTimes(1500);

    // last_signature должен быть обновлён только 1 раз, на последнюю сигнатуру
    expect(updateSigSpy).toHaveBeenCalledTimes(1);
    expect(updateSigSpy).toHaveBeenCalledWith('chain-test', 'account-test', 'sig-1499');
  });
});
