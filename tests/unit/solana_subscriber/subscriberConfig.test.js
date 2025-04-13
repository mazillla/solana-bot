import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/solana_subscriber/db/db.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { pool } from '@/services/solana_subscriber/db/db.js';
import { getSubscriberConfigFromDb } from '@/services/solana_subscriber/db/subscriberConfig.js';

describe('getSubscriberConfigFromDb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('возвращает последнюю конфигурацию', async () => {
    const mockConfig = {
      rpc_endpoints: [{ http: 'http://example.com', ws: 'ws://example.com' }],
      control_accounts: ['acc1', 'acc2'],
      silence_threshold_ms: 5000,
      queue_max_length: 1000,
      rpc_timeout_ms: 3000,
    };

    pool.query.mockResolvedValue({ rows: [mockConfig] });

    const result = await getSubscriberConfigFromDb();
    expect(result).toEqual(mockConfig);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('бросает ошибку, если конфигурация отсутствует', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await expect(getSubscriberConfigFromDb()).rejects.toThrow('Нет доступной конфигурации в таблице subscriber_config');
  });
});
