import pg from 'pg';
import { sharedLogger } from '../../../utils/sharedLogger.js';

export const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL || 'postgres://user:pass@localhost:5432/yourdb',
});

export async function initPostgres() {
  await pool.connect(); // тестируем подключение
  try {
    await sharedLogger({
      service: 'solana_subscriber',
      level: 'info',
      message: { type: 'postgres_connected', message: 'Подключено к PostgreSQL' },
    });
  } catch (_) {}
}

export async function closePostgres() {
  await pool.end();
  try {
    await sharedLogger({
      service: 'solana_subscriber',
      level: 'info',
      message: { type: 'postgres_disconnected', message: 'Отключено от PostgreSQL' },
    });
  } catch (_) {}
}
