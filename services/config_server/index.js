import Fastify from 'fastify';
import cors from '@fastify/cors';
import configRoutes from './routes/config.js';

const fastify = Fastify({ logger: true });

await fastify.register(cors); // Разрешаем CORS для React UI
await fastify.register(configRoutes); // Роуты конфигурации

const PORT = process.env.PORT || 3001;

fastify.listen({ port: PORT, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`🚀 Config Server listening on ${address}`);
});
