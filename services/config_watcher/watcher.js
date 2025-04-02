import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateEvent } from '../../utils/eventSchemas.js';
import { redisClient } from '../../utils/redisClient.js';
import  logger  from '../../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.resolve(__dirname, '../../config/config.json');
const statePath = path.resolve(__dirname, '../../config/last_state.json');
const REDIS_STREAM_KEY = 'config:updates';

export async function checkConfigChangesAndPublish() {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const lastState = fs.existsSync(statePath)
      ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
      : null;

    if (JSON.stringify(config) === JSON.stringify(lastState)) {
      logger.info('[watcher] Конфиг не изменился.');
      return;
    }

    logger.info('[watcher] Обнаружены изменения в config.json');

    // Формируем payload по схеме
    const payload = {
      target: 'config.json',
      changed: config
    };

    const { valid, missingFields } = validateEvent('CONFIG_UPDATE', payload);
    if (!valid) {
      logger.error('[watcher] Ошибка валидации схемы:', missingFields);
      return;
    }

    // Отправка в Redis Stream
    await redisClient.xadd(
      REDIS_STREAM_KEY,
      '*',
      'event',
      JSON.stringify({
        type: 'CONFIG_UPDATE',
        data: payload
      })
    );

    logger.info('[watcher] Конфигурация отправлена в Redis Stream');

    // Сохраняем новое состояние
    fs.writeFileSync(statePath, JSON.stringify(config, null, 2));
    logger.info('[watcher] last_state.json обновлён');

  } catch (err) {
    logger.error('[watcher] Ошибка при сравнении или отправке:', err);
  }
}
