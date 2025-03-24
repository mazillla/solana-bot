import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.resolve(__dirname, '../../../config/config.json');

export default async function (fastify) {
  // GET /config
  fastify.get('/config', async (request, reply) => {
    try {
      const data = fs.readFileSync(configPath, 'utf8');
      const json = JSON.parse(data);
      return json;
    } catch (err) {
      fastify.log.error('Ошибка чтения config.json:', err);
      reply.code(500).send({ error: 'Ошибка сервера' });
    }
  });

  // POST /config
  fastify.post('/config', async (request, reply) => {
    const newConfig = request.body;

    if (!newConfig.globals || !newConfig.schemas) {
      return reply.code(400).send({ error: 'Отсутствует секция globals или schemas' });
    }

    try {
      fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf8');
      return { success: true };
    } catch (err) {
      fastify.log.error('Ошибка записи config.json:', err);
      reply.code(500).send({ error: 'Ошибка при сохранении' });
    }
  });
}
