// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import * as redis from 'redis';
import { sharedLogger } from '@/utils/sharedLogger.js';
import * as safe from '@/utils/safeStringify.js';

describe('D10: Сломан JSON → sharedLogger не падает', () => {
  it('не выбрасывает ошибку, если safeStringify падает', async () => {
    const connect = vi.fn();
    const xAdd = vi.fn();
    vi.spyOn(redis, 'createClient').mockReturnValue({
      connect,
      xAdd,
    });

    vi.spyOn(safe, 'safeStringify').mockImplementation(() => {
      throw new Error('💥 ошибка сериализации');
    });

    let errorThrown = false;
    try {
      await sharedLogger({
        service: 'solana_subscriber',
        level: 'error',
        message: { foo: 'bar' },
      });
    } catch (err) {
      errorThrown = true;
    }

    expect(errorThrown).toBe(false);
  });
});
