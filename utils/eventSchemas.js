import { getSchema } from './configManager.js';

/**
 * Проверка события на соответствие схеме
 * @param {string} eventName - Название события (например, "CONFIG_UPDATE")
 * @param {object} payload - Объект с данными события
 * @returns {{ valid: boolean, missingFields?: string[] }}
 */
export function validateEvent(eventName, payload) {
  const schema = getSchema(eventName);

  if (!schema) {
    return {
      valid: false,
      missingFields: [`Неизвестная схема для события "${eventName}"`]
    };
  }

  const requiredFields = schema.fields || [];
  const missingFields = requiredFields.filter(field => !(field in payload));

  if (missingFields.length > 0) {
    return {
      valid: false,
      missingFields
    };
  }

  return { valid: true };
}
