import { describe, it, expect, vi, beforeEach } from 'vitest';

// Мокаем getSubscriberConfigFromDb
vi.mock('../services/solana_subscriber/db/subscriberConfig.js', () => ({
  getSubscriberConfigFromDb: vi.fn(),
}));

vi.mock('../utils/sharedLogger.js', () => ({
  sharedLogger: vi.fn(),
}));

import * as configLoader from '../services/solana_subscriber/config/configLoader.js'; // Импортируем сам модуль configLoader
import { getSubscriberConfigFromDb } from '../services/solana_subscriber/db/subscriberConfig.js'; // Импортируем getSubscriberConfigFromDb
import { sharedLogger } from '../utils/sharedLogger.js';

describe('configLoader', () => {
  const mockConfig = {
    rpc_endpoints: [{ http: 'http://localhost', ws: 'ws://localhost', rate_limits: { max_requests_per_sec: 10 } }],
    control_accounts: ['abc123'],
    silence_threshold_ms: 30000,
    queue_max_length: 1000,
    rpc_timeout_ms: 5000,
  };

  beforeEach(() => {
    vi.restoreAllMocks(); // Сброс всех моков
  });

  it('загружает конфиг из БД и кэширует его', async () => {
    // Мокируем возвращаемое значение для getSubscriberConfigFromDb
    getSubscriberConfigFromDb.mockResolvedValue(mockConfig);

    // Загружаем конфигурацию
    const config = await configLoader.loadSubscriberConfig();
    expect(config).toEqual(mockConfig);

    const cached = configLoader.getCurrentConfig();
    expect(cached).toEqual(mockConfig);

    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'solana_subscriber',
        level: 'info',
        message: '🔄 Конфигурация загружена из БД',
      })
    );
  });

  it('обновляет конфиг по команде update_config', async () => {
    const newConfig = { ...mockConfig, rpc_timeout_ms: 7000 };
    getSubscriberConfigFromDb.mockResolvedValue(newConfig);

    const updated = await configLoader.updateAndReloadConfig();
    expect(updated.rpc_timeout_ms).toBe(7000);
    expect(configLoader.getCurrentConfig().rpc_timeout_ms).toBe(7000);

    expect(sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'solana_subscriber',
        level: 'info',
        message: '♻️ Конфигурация обновлена из БД по команде update_config',
      })
    );
  });
});
