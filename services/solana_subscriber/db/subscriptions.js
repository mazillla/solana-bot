import { pool } from './db.js';

export async function getActiveSubscriptions() {
  const { rows } = await pool.query(`
    SELECT chain_id, account, subscription_type
    FROM subscriptions
    WHERE active = true
  `);
  return rows;
}

export async function updateLastSignature(chain_id, account, signature) {
  await pool.query(
    `
    UPDATE subscriptions
    SET last_signature = $1,
        updated_at = NOW()
    WHERE chain_id = $2 AND account = $3
    `,
    [signature, chain_id, account]
  );
}

export async function getLastSignatureForAccount(chain_id, account) {
  const { rows } = await pool.query(
    `
    SELECT last_signature FROM subscriptions
    WHERE chain_id = $1 AND account = $2
    `,
    [chain_id, account]
  );
  return rows[0]?.last_signature || null;
}
