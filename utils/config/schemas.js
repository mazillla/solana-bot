// utils/config/schemas.js

// ✅ ГОТОВ

export const schemas = {
    subscribe_command: {
      fields: ['chain_id', 'account'],
    },
    unsubscribe_command: {
      fields: ['chain_id', 'account'],
    },
    config_update_command: {
      fields: [],
    }
  };
  