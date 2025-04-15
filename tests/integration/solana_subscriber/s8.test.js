/// <reference types="vitest" />
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import * as db from '@/services/solana_subscriber/db/db.js';
import * as sharedLogger from '@/utils/sharedLogger.js';
import * as startModule from '@/services/solana_subscriber/start.js';

vi.mock('@/services/solana_subscriber/db/db.js');
vi.mock('@/utils/sharedLogger.js');

describe('S8 — sharedLogger не работает', () => {
  const originalExit = process.exit;

  beforeEach(() => {
    vi.clearAllMocks();
    process.exit = vi.fn();
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  test('если sharedLogger падает — process.exit(1) всё равно вызывается', async () => {
    sharedLogger.sharedLogger.mockRejectedValue(new Error('logger unavailable'));
    db.initPostgres.mockResolvedValue(); // не должен быть вызван

    await startModule.start();

    expect(process.exit).toHaveBeenCalledWith(1);
    expect(db.initPostgres).not.toHaveBeenCalled();
  });
});
