// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import * as postgres from '@/services/solana_subscriber/db/db.js';
import * as logger from '@/utils/sharedLogger.js';
import { start } from '@/services/solana_subscriber/start.js';

describe('D12: Postgres не поднят → сервис не стартует', () => {
  it('логирует ошибку и завершает процесс', async () => {
    const error = new Error('Postgres connection failed');

    // 💥 Симулируем ошибку при инициализации Postgres
    vi.spyOn(postgres, 'initPostgres').mockRejectedValue(error);

    const loggerSpy = vi.spyOn(logger, 'sharedLogger').mockResolvedValue();

    // 🧼 Подменяем process.exit, чтобы не завершался тест
    const originalExit = process.exit;
    vi.stubGlobal('process', {
      ...process,
      exit: vi.fn(),
    });

    await start();

    // ✅ Проверяем, что ошибка залогирована
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        service: 'solana_subscriber',
        level: 'error',
        message: expect.stringContaining('Ошибка при инициализации: Postgres connection failed'),
      })
    );

    // ✅ Проверяем, что вызван process.exit(1)
    expect(process.exit).toHaveBeenCalledWith(1);

    // 🔁 Восстанавливаем process.exit
    global.process.exit = originalExit;
  });
});
