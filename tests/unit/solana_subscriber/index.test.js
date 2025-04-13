import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('solana_subscriber/index.js', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('вызывает start() и подписывается на SIGINT/SIGTERM', async () => {
    const startMock = vi.fn();
    const shutdownMock = vi.fn();

    const onSpy = vi.spyOn(process, 'on');

    vi.doMock('@/services/solana_subscriber/start.js', () => ({
      start: startMock,
      shutdown: shutdownMock,
    }));

    await import('@/services/solana_subscriber/index.js');

    expect(startMock).toHaveBeenCalled();

    expect(onSpy).toHaveBeenCalledWith('SIGINT', shutdownMock);
    expect(onSpy).toHaveBeenCalledWith('SIGTERM', shutdownMock);
  });
});
