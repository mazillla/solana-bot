// services/solana_subscriber/subscription/maybeTriggerRecovery.js
import { recoverTransactions } from './recoveryManager.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';
import { getCurrentConfig } from '../config/configLoader.js';

const lastRecoveryMap = new Map(); // key: chain_id:account → timestamp

export function maybeTriggerRecovery(chain_id, account) {
  const key = `${chain_id}:${account}`;
  const now = Date.now();

  const cooldown = getCurrentConfig().recovery_cooldown_ms || 60000;
  const lastTime = lastRecoveryMap.get(key);
  if (lastTime && now - lastTime < cooldown) {
    return; // слишком рано, пропускаем
  }

  lastRecoveryMap.set(key, now);

  try {
    sharedLogger({
      service: 'solana_subscriber',
      level: 'info',
      message: {
        type: 'recovery_triggered_success',
        chain_id,
        account,
      },
    });
  } catch (_) {}

  recoverTransactions({
    chain_id,
    account,
    last_signature: null,
    history_max_age_ms: null,
  }).catch(async (err) => {
    try {
      await sharedLogger({
        service: 'solana_subscriber',
        level: 'error',
        message: {
          type: 'recovery_trigger_failed',
          chain_id,
          account,
          error: err.message,
        },
      });
    } catch (_) {}
  });
}
