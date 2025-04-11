import { pool } from './db.js';

export async function getSubscriberConfigFromDb() {
  const query = `
    SELECT 
      rpc_endpoints,
      control_accounts,
      silence_threshold_ms,
      queue_max_length,
      rpc_timeout_ms
    FROM subscriber_config
    ORDER BY updated_at DESC
    LIMIT 1;
  `;

  const { rows } = await pool.query(query);

  if (!rows.length) {
    throw new Error('Нет доступной конфигурации в таблице subscriber_config');
  }

  return rows[0];
}
