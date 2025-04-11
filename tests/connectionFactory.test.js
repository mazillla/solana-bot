import { describe, it, expect, vi, beforeEach } from 'vitest';
import { connectionFactory } from '../services/solana_subscriber/rpc/connectionFactory.js';
import { Connection } from '@solana/web3.js';

// 🧪 Мокаем Connection для отслеживания
vi.mock('@solana/web3.js', () => ({
  Connection: vi.fn().mockImplementation(() => ({})),
}));

describe('connectionFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates connection without wsUrl', () => {
    connectionFactory('http://localhost:8899');

    expect(Connection).toHaveBeenCalledWith('http://localhost:8899', {
      commitment: 'confirmed',
    });
  });

  it('creates connection with wsUrl', () => {
    connectionFactory('http://localhost:8899', 'wss://ws.solana.com');

    expect(Connection).toHaveBeenCalledWith('http://localhost:8899', {
      commitment: 'confirmed',
      wsEndpoint: 'wss://ws.solana.com',
    });
  });
});
