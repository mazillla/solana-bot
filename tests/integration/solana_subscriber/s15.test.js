import { describe, it, expect, vi, beforeEach } from 'vitest';

// Мокаем зависимости
vi.mock('@/services/solana_subscriber/rpc/rpcUtils.js', () => ({
  getParsedTransactionWithTimeout: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/utils/redisLogSender.js', () => ({
  redisPublishLog: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/db/subscriptions.js', () => ({
  updateLastSignature: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/queue/retryQueue.js', () => ({
  scheduleRetry: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/queue/redisRetryQueue.js', () => ({
  enqueueRedisRetry: vi.fn(),
}));

vi.mock('@/utils/sharedLogger.js', () => ({
  sharedLogger: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/config/configLoader.js', () => ({
  getCurrentConfig: () => ({
    rpc_timeout_ms: 5000,
  }),
}));

// Импортируем функцию для теста
import { getParsedTransactionWithTimeout } from '@/services/solana_subscriber/rpc/rpcUtils.js';
import { redisPublishLog } from '@/services/solana_subscriber/utils/redisLogSender.js';
import { scheduleRetry } from '@/services/solana_subscriber/queue/retryQueue.js';

import { handleLogEvent } from '@/services/solana_subscriber/subscription/onLogsHandler.js';

// Общие данные для тестов
const common = {
  chain_id: 'chain1',
  account: 'abc123',
  signature: 'sig001',
  subscription_type: 'regular',
  rpc: { id: 'rpc-1', limiter: { removeToken: () => true } },
};

const flushPromises = () => new Promise(setImmediate);

describe('onLogsHandler - S15: повторная попытка при getParsedTransaction === null', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('повторно обрабатывает транзакцию, если getParsedTransaction вернул null', async () => {
    // Мокаем getParsedTransactionWithTimeout
    getParsedTransactionWithTimeout
      .mockResolvedValueOnce(null)  // Первый вызов — null
      .mockResolvedValueOnce({ meta: {}, transaction: {} }); // Второй — валидная транзакция

    const logInfo = { signature: 'sig001', err: null };

    // Запускаем обработку
    await handleLogEvent(common);

    // Ожидаем завершения всех промисов
    await flushPromises();

    // Проверяем, что getParsedTransaction был вызван дважды
    expect(getParsedTransactionWithTimeout).toHaveBeenCalledTimes(2);
    expect(getParsedTransactionWithTimeout).toHaveBeenCalledWith('sig001', { commitment: 'confirmed' });

    // Проверяем, что retry был запланирован, но redisPublishLog не был вызван
    expect(scheduleRetry).toHaveBeenCalledWith('sig001');
    expect(redisPublishLog).not.toHaveBeenCalled();
  });
});
