/// <reference types="vitest" />
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import * as db from '@/services/solana_subscriber/db/db.js';
import * as configLoader from '@/services/solana_subscriber/config/configLoader.js';
import * as sharedLogger from '@/utils/sharedLogger.js';
import * as startModule from '@/services/solana_subscriber/start.js';

vi.mock('@/services/solana_subscriber/db/db.js');
vi.mock('@/services/solana_subscriber/config/configLoader.js');
vi.mock('@/utils/sharedLogger.js');

describe('S3 — initPostgres выбрасывает ошибку', () => {
  const originalExit = process.exit;

  beforeEach(() => {
    vi.clearAllMocks();
    process.exit = vi.fn();
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  test('если initPostgres кидает ошибку — логируется и вызывается exit(1)', async () => {
    db.initPostgres.mockRejectedValue(new Error('db init failed'));
    sharedLogger.sharedLogger.mockResolvedValue();

    await startModule.start();

    expect(sharedLogger.sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'solana_subscriber',
        level: 'error',
        message: expect.stringContaining('Ошибка при инициализации: db init failed'),
      })
    );

    expect(process.exit).toHaveBeenCalledWith(1);
    expect(configLoader.loadSubscriberConfig).not.toHaveBeenCalled();
  });
});
