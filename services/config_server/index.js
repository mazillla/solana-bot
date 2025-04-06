import Fastify from 'fastify';
import cors from '@fastify/cors';
import configRoutes from './routes/config.js';
import { sharedLogger } from '../../utils/sharedLogger.js'; // 👈 импорт нового логгера

const SERVICE_NAME = 'config_server';

const fastify = Fastify({ logger: false });

await fastify.register(cors);
await fastify.register(configRoutes);

const PORT = process.env.PORT || 3001;

fastify.listen({ port: PORT, host: '0.0.0.0' }, async (err, address) => {
  if (err) {
    await sharedLogger({
      service: SERVICE_NAME,
      level: 'error',
      message: `Ошибка запуска сервера: ${err.message}`,
    });
    process.exit(1);
  }

  await sharedLogger({
    service: SERVICE_NAME,
    level: 'info',
    message: `🚀 Config Server listening on ${address}`,
  });
});
