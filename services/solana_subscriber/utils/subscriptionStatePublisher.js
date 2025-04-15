// services/solana_subscriber/utils/subscriptionStatePublisher.js
import { getRedisClient } from '../../../utils/redisClientSingleton.js';
import { sharedLogger } from '../../../utils/sharedLogger.js';

const STREAM_KEY = 'subscriber_subscription_state';

export async function sendSubscriptionStateUpdate({ chain_id, account, active, connected }) {
  try {
    const redis = await getRedisClient();

    const message = {
      type: 'SUBSCRIPTION_STATE_CHANGED',
      chain_id,
      account,
      active,
      connected,
      timestamp: Date.now(),
    };

    await redis.xAdd(STREAM_KEY, '*', {
      data: JSON.stringify(message),
    });
  } catch (err) {
    try {
      await sharedLogger({
        service: 'subscription_state_publisher',
        level: 'error',
        message: {
          type: 'publish_subscription_state_failed',
          error: err.message,
          account,
          chain_id,
        },
      });
    } catch (_) {}
  }
}
