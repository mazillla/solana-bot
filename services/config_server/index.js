import Fastify from 'fastify';
import cors from '@fastify/cors';
import configRoutes from './routes/config.js';
import logger from '../../utils/logger.js';

const fastify = Fastify({ logger: false }); // отключаем встроенный Fastify логгер

await fastify.register(cors); // Разрешаем CORS для React UI
await fastify.register(configRoutes); // Роуты конфигурации

const PORT = process.env.PORT || 3001;

fastify.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    logger.error("Ошибка запуска сервера", { error: err.message });
    process.exit(1);
  }
  logger.info(`🚀 Config Server listening on ${address}`);
});
