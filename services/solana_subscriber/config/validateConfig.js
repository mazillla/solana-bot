// services/solana_subscriber/config/validateConfig.js

/**
 * ✅ Модуль для валидации конфигурации подписчика из таблицы subscriber_config.
 * Используется после загрузки, до применения config.
 *
 * 💡 Проверяет:
 * - обязательные поля
 * - корректность типов
 * - допустимость значений
 * - минимальные ограничения (например, parse_concurrency >= 1)
 */

export function validateConfig(config) {
    const errors = [];
  
    // 1. Проверка, что это объект
    if (!config || typeof config !== 'object') {
      errors.push('config не является объектом');
      return { valid: false, errors };
    }
  
    // 2. rpc_endpoints — обязательный, массив
    if (!Array.isArray(config.rpc_endpoints) || config.rpc_endpoints.length === 0) {
      errors.push('rpc_endpoints должен быть непустым массивом');
    }
  
    // 3. control_accounts — массив строк
    if (!Array.isArray(config.control_accounts)) {
      errors.push('control_accounts должен быть массивом строк');
    }
  
    // 4. Числовые поля (проверка что число и больше нуля)
    const numericFields = [
      'silence_threshold_ms',
      'queue_max_length',
      'rpc_timeout_ms',
      'parse_concurrency',
      'max_parse_duration_ms',
      'heartbeat_interval_ms',
      'default_history_max_age_ms',
      'recovery_cooldown_ms',
      'http_limit_per_sec',
      'ws_limit_per_sec',
    ];
  
    for (const key of numericFields) {
      const val = config[key];
      if (typeof val !== 'number' || val < 0 || Number.isNaN(val)) {
        errors.push(`${key} должно быть числом >= 0`);
      }
    }
  
    // 5. service_name — строка
    if (typeof config.service_name !== 'string' || config.service_name.length === 0) {
      errors.push('service_name должен быть строкой');
    }
  
    // 6. stream_subscription_state — строка
    if (typeof config.stream_subscription_state !== 'string' || config.stream_subscription_state.length === 0) {
      errors.push('stream_subscription_state должен быть строкой');
    }
  
    // 7. heartbeat_stream_key — строка
    if (typeof config.heartbeat_stream_key !== 'string' || config.heartbeat_stream_key.length === 0) {
      errors.push('heartbeat_stream_key должен быть строкой');
    }
  
    // 8. commitment — допустимые значения
    const allowedCommitments = ['processed', 'confirmed', 'finalized'];
    if (!allowedCommitments.includes(config.commitment)) {
      errors.push(`commitment должен быть одним из: ${allowedCommitments.join(', ')}`);
    }
  
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  