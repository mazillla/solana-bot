import { describe, it, expect, vi } from 'vitest';
import { createLimiter } from '@/services/solana_subscriber/rpc/rpcLimiter.js';

describe('rpcLimiter', () => {
  it('выдаёт токены пока не исчерпаны', () => {
    const limiter = createLimiter(3);

    expect(limiter.removeToken()).toBe(true);
    expect(limiter.removeToken()).toBe(true);
    expect(limiter.removeToken()).toBe(true);
    expect(limiter.removeToken()).toBe(false);
  });

  it('восстанавливает токены через 1 секунду', async () => {
    const limiter = createLimiter(2);
    limiter.removeToken();
    limiter.removeToken();
    expect(limiter.removeToken()).toBe(false);

    await new Promise((res) => setTimeout(res, 1100));

    expect(limiter.removeToken()).toBe(true);
  });

  it('останавливает интервал через stop()', () => {
    const clearSpy = vi.spyOn(global, 'clearInterval');
    const limiter = createLimiter(5);

    limiter.stop();

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
