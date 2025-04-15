import { vi } from 'vitest';

// Мокаем sharedLogger ДО загрузки любых тестов
vi.mock('@/utils/sharedLogger.js', () => ({
  sharedLogger: vi.fn(async () => {}),
}));

// Если потребуется — можешь мокать и другие модули здесь
