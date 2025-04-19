// services/solana_subscriber/db/subscriptions.js

// ✅ ГОТОВ

// 📦 Импорт пула соединений PostgreSQL
import { pool } from './db.js';

// 🧠 Импорт конфигурации сервиса (для sharedLogger)
import { getCurrentConfig } from '../config/configLoader.js';

// 📢 Общий логгер, отправляющий сообщения в Redis stream
import { sharedLogger } from '../../../utils/sharedLogger.js';

/**
 * 🔁 Получает все активные подписки из таблицы `subscriptions`.
 * Используется при старте сервиса, чтобы восстановить подписки.
 */
export async function getActiveSubscriptions() {
  const { rows } = await pool.query(`
    SELECT chain_id, account, priority
    FROM subscriptions
    WHERE active = true
  `);

  return rows; // [{ chain_id, account, priority }]
}

/**
 * 💾 Обновляет поле `last_signature` и метку времени `updated_at`
 * для указанной подписки (chain_id + account).
 */
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

/**
 * 🧾 Получает текущую сохранённую сигнатуру (`last_signature`)
 * для пары `chain_id:account`. Используется при восстановлении истории.
 */
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

/**
 * 🔁 Вставляет новую подписку или обновляет существующую.
 * 
 * Поведение:
 * - если подписка отсутствует → вставка (`INSERT`)
 * - если уже есть → обновление только переданных полей (`UPDATE`)
 * 
 * Всегда устанавливает `active = true`.
 */
export async function upsertSubscription({
  chain_id,
  account,
  last_signature,
  history_max_age_ms,
  priority
}) {
  try {
    // 🔍 Проверка на наличие подписки
    const existing = await pool.query(
      `SELECT * FROM subscriptions WHERE chain_id = $1 AND account = $2`,
      [chain_id, account]
    );

    // 🟢 Вставка новой записи
    if (existing.rows.length === 0) {
      await pool.query(
        `
        INSERT INTO subscriptions (
          chain_id, account, active, last_signature, history_max_age_ms, priority
        ) VALUES ($1, $2, true, $3, $4, $5)
        `,
        [
          chain_id,
          account,
          last_signature,
          history_max_age_ms,
          priority === true
        ]
      );

      await sharedLogger({
        service: getCurrentConfig().service_name,
        level: 'info',
        message: {
          type: 'subscription_inserted',
          chain_id,
          account,
          last_signature,
          history_max_age_ms,
          priority: priority === true,
        },
      });

    } else {
      // 🟡 Обновление существующей записи
      const updates = [];
      const values = [chain_id, account];
      let paramIndex = 3;

      if (last_signature !== undefined) {
        updates.push(`last_signature = $${paramIndex++}`);
        values.push(last_signature);
      }

      if (history_max_age_ms !== undefined) {
        updates.push(`history_max_age_ms = $${paramIndex++}`);
        values.push(history_max_age_ms);
      }

      if (priority !== undefined) {
        updates.push(`priority = $${paramIndex++}`);
        values.push(priority === true);
      }

      updates.push(`active = true`);
      updates.push(`updated_at = CURRENT_TIMESTAMP`);

      await pool.query(
        `
        UPDATE subscriptions
        SET ${updates.join(', ')}
        WHERE chain_id = $1 AND account = $2
        `,
        values
      );

      await sharedLogger({
        service: getCurrentConfig().service_name,
        level: 'info',
        message: {
          type: 'subscription_updated',
          chain_id,
          account,
          updated_fields: updates,
        },
      });
    }

  } catch (err) {
    await sharedLogger({
      service: getCurrentConfig().service_name,
      level: 'error',
      message: {
        type: 'upsert_subscription_failed',
        chain_id,
        account,
        error: err.message,
      },
    });

    throw err;
  }
}

/**
 * 🔻 Помечает подписку как неактивную (active = false).
 * Используется при отписке от аккаунта.
 */
export async function deactivateSubscription({ chain_id, account }) {
  try {
    await pool.query(
      `
      UPDATE subscriptions
      SET active = false,
          updated_at = NOW()
      WHERE chain_id = $1 AND account = $2
      `,
      [chain_id, account]
    );

    await sharedLogger({
      service: getCurrentConfig().service_name,
      level: 'info',
      message: {
        type: 'subscription_deactivated',
        chain_id,
        account,
      },
    });

  } catch (err) {
    await sharedLogger({
      service: getCurrentConfig().service_name,
      level: 'error',
      message: {
        type: 'deactivate_subscription_failed',
        chain_id,
        account,
        error: err.message,
      },
    });

    throw err;
  }
}
