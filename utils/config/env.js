// utils/config/env.js

// ✅ ГОТОВ

/**
 * Получает значение переменной окружения.
 *
 * @param {string} key - название переменной (например, "POSTGRES_URL")
 * @param {Object} options
 * @param {boolean} options.required - обязательность (по умолчанию true)
 * @param {*} options.fallback - значение по умолчанию
 */
export function getEnvVar(key, { required = true, fallback = undefined } = {}) {
    const value = process.env[key] ?? fallback;
  
    if (required && value === undefined) {
      console.error(`[env] ❌ Обязательная переменная ${key} не задана и не имеет fallback`);
      process.exit(1);
    }
  
    return value;
  }
  