import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  pollStream,
  setRunning,
  startRedisConsumer,
  stopRedisConsumer,
} from '@/services/solana_subscriber/config/redisConsumer.js';

const mockRedisClient = {
  connect: vi.fn(),
  quit: vi.fn(),
  xRead: vi.fn(),
  xAdd: vi.fn(),
};

vi.mock('redis', () => ({
  createClient: vi.fn(() => mockRedisClient),
}));

vi.mock('@/services/solana_subscriber/subscription/subscriptionManager.js', () => ({
  subscribeToAccount: vi.fn(),
  unsubscribeFromAccount: vi.fn(),
  resubscribeAll: vi.fn(),
}));

vi.mock('@/services/solana_subscriber/config/configLoader.js', () => ({
  updateAndReloadConfig: vi.fn(),
}));

vi.mock('@/utils/sharedLogger.js', () => ({
  sharedLogger: vi.fn(),
}));

import {
  subscribeToAccount,
  unsubscribeFromAccount,
  resubscribeAll,
} from '@/services/solana_subscriber/subscription/subscriptionManager.js';
import { updateAndReloadConfig } from '@/services/solana_subscriber/config/configLoader.js';
import { sharedLogger } from '@/utils/sharedLogger.js';

describe('pollStream', () => {
  const makeMockMessage = (payload) => [
    '100-0',
    {
      data: {
        data: JSON.stringify(payload),
      },
    },
  ];

  const setupPollOnce = async (payload) => {
    mockRedisClient.xRead.mockResolvedValueOnce([
      {
        messages: [makeMockMessage(payload)],
      },
    ]).mockResolvedValueOnce(null);

    setRunning(true);
    const p = pollStream(mockRedisClient, '0-0');
    await new Promise(r => setTimeout(r, 50));
    setRunning(false);
    await p;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(mockRedisClient).forEach(fn => fn.mockReset?.());
    mockRedisClient.xAdd.mockResolvedValue();
  });

  it('handles subscribe', async () => {
    const payload = {
      action: 'subscribe',
      chain_id: 'c1',
      account: 'acc1',
      subscription_type: 'logs',
    };

    await setupPollOnce(payload);

    expect(subscribeToAccount).toHaveBeenCalledWith({
      chain_id: 'c1',
      account: 'acc1',
      subscription_type: 'logs',
    });

    expect(sharedLogger).toHaveBeenCalledWith(expect.objectContaining({
      message: { type: 'subscribe_command', payload },
    }));
  });

  it('handles unsubscribe', async () => {
    const payload = {
      action: 'unsubscribe',
      chain_id: 'c2',
      account: 'acc2',
    };

    await setupPollOnce(payload);

    expect(unsubscribeFromAccount).toHaveBeenCalledWith('c2:acc2');
    expect(sharedLogger).toHaveBeenCalledWith(expect.objectContaining({
      message: { type: 'unsubscribe_command', payload },
    }));
  });

  it('handles update_config', async () => {
    const payload = { action: 'update_config' };

    await setupPollOnce(payload);

    expect(updateAndReloadConfig).toHaveBeenCalled();
    expect(resubscribeAll).toHaveBeenCalled();
    expect(sharedLogger).toHaveBeenCalledWith(expect.objectContaining({
      message: { type: 'config_update_command' },
    }));
  });

  it('handles unknown command', async () => {
    const payload = { action: 'abracadabra' };

    await setupPollOnce(payload);

    expect(sharedLogger).toHaveBeenCalledWith(expect.objectContaining({
      message: { type: 'unknown_command', payload },
    }));
  });
});

describe('start/stopRedisConsumer and error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(mockRedisClient).forEach(fn => fn.mockReset?.());
    mockRedisClient.xAdd.mockResolvedValue();
  });

  it('calls startRedisConsumer and initializes redisClient', async () => {
    await startRedisConsumer();
    expect(mockRedisClient.connect).toHaveBeenCalled();
  });

  it('calls stopRedisConsumer and quits redisClient', async () => {
    await startRedisConsumer();
    await stopRedisConsumer();
    expect(mockRedisClient.quit).toHaveBeenCalled();
  });

  it('logs redis_consumer_error if xRead throws', async () => {
    mockRedisClient.xRead.mockRejectedValueOnce(new Error('xRead fail'));

    setRunning(true);
    await pollStream(mockRedisClient);
    setRunning(false);

    expect(sharedLogger).toHaveBeenCalledWith(expect.objectContaining({
      level: 'error',
      message: expect.objectContaining({
        type: 'redis_consumer_error',
        error: 'xRead fail',
      }),
    }));
  });
});
