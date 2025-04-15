// tests/integration/solana_subscriber/i10.test.js
import { describe, it, expect, beforeEach } from 'vitest';

describe('i10 — onLogsQueue не добавляет дубликаты сигнатур', () => {
  let enqueueSignature, dequeueSignature, getQueueLength;

  beforeEach(async () => {
    vi.resetModules();
    const queueModule = await import('@/services/solana_subscriber/queue/onLogsQueue.js');
    enqueueSignature = queueModule.enqueueSignature;
    dequeueSignature = queueModule.dequeueSignature;
    getQueueLength = queueModule.getQueueLength;

    // 🔄 полностью сбрасываем очередь перед каждым тестом
    while (dequeueSignature()) {} // вычищаем
  });

  it('не добавляет дубликаты сигнатур', () => {
    const sig = 'dup123';

    enqueueSignature(sig);
    enqueueSignature(sig); // дубликат

    expect(getQueueLength()).toBe(1); // ✅ только один

    const dequeued = dequeueSignature();
    expect(dequeued).toBe(sig);

    expect(getQueueLength()).toBe(0); // ✅ очередь пуста
  });
});
