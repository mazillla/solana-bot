// utils/config/index.js

// ✅ ГОТОВ

// ✅ Загружаем переменные окружения из .env
import dotenv from 'dotenv';
dotenv.config(); // автоматически берёт .env из корня проекта

// 📘 Утилита для безопасного чтения env-переменных
import { getEnvVar } from './env.js';

// 📋 Схема переменных окружения (POSTGRES_URL, REDIS_URL и т.п.)
import { envSchema } from './schema.js';

// 📑 Схемы Redis-команд для валидации (subscribe_command, unsubscribe и т.п.)
import { schemas } from './schemas.js';

/**
 * ✅ Централизованная конфигурация всего проекта
 * Используется во всех модулях: логгер, БД, Redis, RedisStreamBus, и т.д.
 */
export const CONFIG = {
  /**
   * 🔌 PostgreSQL
   * Пример: postgres://user:pass@postgres:5432/dbname
   */
  db: {
    connectionString: getEnvVar('POSTGRES_URL', envSchema.POSTGRES_URL),
  },

  /**
   * 📡 Redis
   * Пример: redis://localhost:6379
   */
  redis: {
    url: getEnvVar('REDIS_URL', envSchema.REDIS_URL),
  },

  /**
   * 📝 Уровень логирования (debug, info, warn, error)
   */
  logLevel: getEnvVar('LOG_LEVEL', envSchema.LOG_LEVEL),

  /**
   * 🌍 Окружение (development, production, test)
   */
  environment: getEnvVar('NODE_ENV', envSchema.NODE_ENV),

  /**
   * 📑 Схемы для валидации Redis-команд
   * Используются в validateEvent(...) для проверки полей
   */
  schemas,
};
