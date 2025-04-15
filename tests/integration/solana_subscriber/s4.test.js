/// <reference types="vitest" />
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import * as db from '@/services/solana_subscriber/db/db.js';
import * as configLoader from '@/services/solana_subscriber/config/configLoader.js';
import * as rpcPool from '@/services/solana_subscriber/rpc/rpcPool.js';
import * as sharedLogger from '@/utils/sharedLogger.js';
import * as startModule from '@/services/solana_subscriber/start.js';

vi.mock('@/services/solana_subscriber/db/db.js');
vi.mock('@/services/solana_subscriber/config/configLoader.js');
vi.mock('@/services/solana_subscriber/rpc/rpcPool.js');
vi.mock('@/utils/sharedLogger.js');

describe('S4 — initRpcPool выбрасывает ошибку', () => {
  const originalExit = process.exit;

  beforeEach(() => {
    vi.clearAllMocks();
    process.exit = vi.fn();
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  test('если initRpcPool кидает ошибку — логируется и вызывается exit(1)', async () => {
    db.initPostgres.mockResolvedValue();
    configLoader.loadSubscriberConfig.mockResolvedValue({ rpc_endpoints: ['http://x'] });
    rpcPool.initRpcPool.mockRejectedValue(new Error('rpc init failed'));
    sharedLogger.sharedLogger.mockResolvedValue();

    await startModule.start();

    expect(sharedLogger.sharedLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'solana_subscriber',
        level: 'error',
        message: expect.stringContaining('Ошибка при инициализации: rpc init failed'),
      })
    );

    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
