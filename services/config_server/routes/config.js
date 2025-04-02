import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../../utils/logger.js'; // ✅ импорт логгера

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.resolve(__dirname, '../../../config/config.json');

const SERVICE_NAME = 'config_server';

export default async function (fastify) {
  // ✅ Проверочный маршрут
  fastify.get('/', async () => {
    return { status: 'Config Server is running' };
  });

  // ✅ Получение конфига
  fastify.get('/config', async (request, reply) => {
    try {
      const data = fs.readFileSync(configPath, 'utf8');
      const json = JSON.parse(data);
      return json;
    } catch (err) {
      logger.error(SERVICE_NAME, 'Ошибка чтения config.json', { error: err.message });
      reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // ✅ Обновление конфига
  fastify.post('/config', async (request, reply) => {
    const newConfig = request.body;

    if (!newConfig.globals || !newConfig.schemas) {
      logger.warn(SERVICE_NAME, 'Попытка сохранить конфиг без обязательных секций');
      return reply.code(400).send({ error: 'Отсутствует секция globals или schemas' });
    }

    try {
      fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf8');

      logger.info(SERVICE_NAME, '✅ Конфигурация успешно обновлена', {
        updatedKeys: Object.keys(newConfig),
      });

      return { success: true };
    } catch (err) {
      logger.error(SERVICE_NAME, 'Ошибка записи config.json', { error: err.message });
      reply.code(500).send({ error: 'Ошибка при сохранении' });
    }
  });
}
