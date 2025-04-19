// utils/eventSchemas.js

// ✅ ГОТОВ

// 📦 Импорт централизованной конфигурации
// CONFIG.schemas будет содержать описание всех ожидаемых типов событий и обязательных полей
import { CONFIG } from './config/index.js';

/**
 * ✅ Валидация структуры события по схеме
 *
 * @param {string} eventName - Название события (например: 'subscribe_command')
 * @param {object} payload - Объект данных, содержащий поля команды
 * @returns {{
 *   valid: boolean,
 *   missingFields?: string[]
 * }}
 *
 * 💡 Используется для проверки входящих Redis-команд, чтобы убедиться,
 *     что в payload есть все необходимые поля согласно config.json → schemas
 */
export function validateEvent(eventName, payload) {
  // 🔍 Ищем схему по имени события
  // (некоторые схемы могут быть в верхнем регистре — поэтому можно привести к нижнему)
  const schema = CONFIG.schemas?.[eventName];

  // ⚠️ Если схема не найдена — считаем это ошибкой
  if (!schema) {
    return {
      valid: false,
      missingFields: [`Неизвестная схема для события "${eventName}"`]
    };
  }

  // 📋 Извлекаем список обязательных полей из схемы
  const requiredFields = schema.fields || [];

  // 🔎 Проверяем, какие поля отсутствуют в payload
  const missingFields = requiredFields.filter(field => !(field in payload));

  // ❌ Если есть пропущенные поля — считаем невалидным
  if (missingFields.length > 0) {
    return {
      valid: false,
      missingFields
    };
  }

  // ✅ Все поля на месте — успех
  return { valid: true };
}
