import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { redisPublishLog } from '@/services/solana_subscriber/utils/redisLogSender.js';

const mockConnect = vi.fn();
const mockXAdd = vi.fn();

vi.mock('redis', () => ({
  createClient: vi.fn(() => ({
    connect: mockConnect,
    xAdd: mockXAdd,
  })),
}));

describe('S30: redisPublishLog отправляет лог в Redis', () => {
  beforeEach(() => {
    mockConnect.mockClear();
    mockXAdd.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('подключается и вызывает xAdd с корректными параметрами', async () => {
    const streamKey = 'solana_logs_test';
    const message = { chain_id: 'c1', signature: 'sig1', value: 42 };

    await redisPublishLog(streamKey, message);

    expect(mockConnect).toHaveBeenCalledTimes(1);

    expect(mockXAdd).toHaveBeenCalledWith(
      streamKey,
      '*',
      {
        data: JSON.stringify(message),
      }
    );
  });
});
