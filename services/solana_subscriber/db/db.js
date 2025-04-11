import pg from 'pg';
import { sharedLogger } from '../../../utils/sharedLogger.js';  // Импортируем sharedLogger

export const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL || 'postgres://user:pass@localhost:5432/yourdb',
});

export async function initPostgres() {
  await pool.connect(); // Тест подключения
  await sharedLogger({
    service: 'solana_subscriber',
    level: 'info',
    message: { type: 'postgres_connected', message: 'Подключено к PostgreSQL' },
  });
}

export async function closePostgres() {
  await pool.end();
  await sharedLogger({
    service: 'solana_subscriber',
    level: 'info',
    message: { type: 'postgres_disconnected', message: 'Отключено от PostgreSQL' },
  });
}
