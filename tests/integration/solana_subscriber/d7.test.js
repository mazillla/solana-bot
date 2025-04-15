import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  enqueueSignature,
  dequeueSignature,
  getQueueLength,
} from '@/services/solana_subscriber/queue/onLogsQueue.js';

describe('D7: Повторный лог → не обрабатывается повторно', () => {
  beforeEach(() => {
    // очистка очереди
    while (dequeueSignature()) {}
  });

  it('не добавляет дубликат сигнатуры в очередь', () => {
    enqueueSignature('sig-abc123');
    enqueueSignature('sig-abc123'); // вторая попытка

    const length = getQueueLength();
    expect(length).toBe(1);
  });

  it('удаляет сигнатуру из Set при dequeue', () => {
    enqueueSignature('sig-xyz789');
    expect(getQueueLength()).toBe(1);

    const sig = dequeueSignature();
    expect(sig).toBe('sig-xyz789');

    // теперь можно добавить снова
    enqueueSignature('sig-xyz789');
    expect(getQueueLength()).toBe(1);
  });
});
