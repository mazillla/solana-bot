// tests/unit/config/configLoader.test.js
import { describe, it, expect, beforeEach } from 'vitest';

describe('I2 — getCurrentConfig без загрузки конфигурации', () => {
  beforeEach(() => {
    // ❗ Сброс модуля между тестами, чтобы currentConfig стал null
    vi.resetModules();
  });

  it('бросает ошибку, если loadSubscriberConfig не был вызван', async () => {
    const { getCurrentConfig } = await import('@/services/solana_subscriber/config/configLoader.js');

    expect(() => getCurrentConfig()).toThrowError(
      'Конфигурация ещё не загружена. Используй loadSubscriberConfig() сначала.'
    );
  });
});
