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

describe('S32: Неверный формат события → Redis не падает', () => {
  beforeEach(() => {
    mockConnect.mockClear();
    mockXAdd.mockImplementation(() => {
      throw new Error('xAdd crashed');
    });

    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('безопасно обрабатывает ошибку при невалидном сообщении', async () => {
    const streamKey = 'invalid_stream';
    const message = {}; // допустим, toJSON внутри даст ошибку

    // Преднамеренно ломаем JSON
    const circular = {};
    circular.self = circular;

    await redisPublishLog(streamKey, circular);

    expect(console.warn).toHaveBeenCalledWith(
      '[redisPublishLog] Redis error:',
      expect.stringContaining('Converting circular structure')
    );

    // xAdd не должен быть вызван, потому что JSON.stringify упал до этого
    expect(mockXAdd).not.toHaveBeenCalled();
  });
});
