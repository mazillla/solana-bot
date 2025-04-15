import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLimiter } from '@/services/solana_subscriber/rpc/rpcLimiter.js';

describe('S29: rpcLimiter ограничивает частоту запросов', () => {
  let limiter;

  beforeEach(() => {
    vi.useFakeTimers(); // используем фейковые таймеры для контроля времени
    limiter = createLimiter(3); // лимит 3 запроса в секунду
  });

  afterEach(() => {
    vi.useRealTimers(); // сбрасываем таймеры после теста
    limiter.stop();     // обязательно остановить интервал!
  });

  it('разрешает только 3 вызова в секунду', () => {
    expect(limiter.removeToken()).toBe(true); // 1
    expect(limiter.removeToken()).toBe(true); // 2
    expect(limiter.removeToken()).toBe(true); // 3
    expect(limiter.removeToken()).toBe(false); // 4 — превышен
  });

  it('восстанавливает лимит через 1 секунду', () => {
    limiter.removeToken(); // 1
    limiter.removeToken(); // 2
    limiter.removeToken(); // 3

    expect(limiter.removeToken()).toBe(false); // больше нельзя

    vi.advanceTimersByTime(1000); // прошло 1 секунда

    expect(limiter.removeToken()).toBe(true); // лимит восстановлен
  });
});
