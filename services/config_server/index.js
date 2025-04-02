import Fastify from 'fastify';
import cors from '@fastify/cors';
import configRoutes from './routes/config.js';
import logger from '../../utils/logger.js';

const SERVICE_NAME = 'config_server'; // 👈 явно задаем имя

const fastify = Fastify({ logger: false });

await fastify.register(cors);
await fastify.register(configRoutes);

const PORT = process.env.PORT || 3001;

fastify.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    logger.error(SERVICE_NAME, 'Ошибка запуска сервера', { error: err.message });
    process.exit(1);
  }
  logger.info(SERVICE_NAME, `🚀 Config Server listening on ${address}`);
});
