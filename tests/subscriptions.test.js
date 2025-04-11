import { describe, it, expect, vi, beforeEach } from 'vitest';

// 👇 мок до импорта
vi.mock('../services/solana_subscriber/db/db.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { pool } from '../services/solana_subscriber/db/db.js';
import {
  getActiveSubscriptions,
  updateLastSignature,
  getLastSignatureForAccount,
} from '../services/solana_subscriber/db/subscriptions.js';

describe('subscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getActiveSubscriptions возвращает активные подписки', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { chain_id: 'chain1', account: 'acc1', subscription_type: 'regular' },
        { chain_id: 'chain2', account: 'acc2', subscription_type: 'spl_token' },
      ],
    });

    const result = await getActiveSubscriptions();
    expect(result).toHaveLength(2);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
  });

  it('updateLastSignature обновляет подпись', async () => {
    pool.query.mockResolvedValueOnce();

    await updateLastSignature('chain1', 'acc1', 'sig123');
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE subscriptions'),
      ['sig123', 'chain1', 'acc1']
    );
  });

  it('getLastSignatureForAccount возвращает подпись', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ last_signature: 'sig456' }],
    });

    const sig = await getLastSignatureForAccount('chain1', 'acc1');
    expect(sig).toBe('sig456');
  });

  it('getLastSignatureForAccount возвращает null, если нет строки', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const sig = await getLastSignatureForAccount('chain1', 'acc1');
    expect(sig).toBeNull();
  });
});
