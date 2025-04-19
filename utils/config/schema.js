// utils/config/schema.js

// ✅ ГОТОВ

export const envSchema = {
    POSTGRES_URL: { required: true },
    REDIS_URL: { required: false, fallback: 'redis://localhost:6379' },
    LOG_LEVEL: { required: false, fallback: 'info' },
    NODE_ENV: { required: false, fallback: 'development' },
  };
  