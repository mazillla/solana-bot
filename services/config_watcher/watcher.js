import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateEvent } from './utils/eventSchemas.js';
import { redisClient } from './utils/redisClient.js';
import { sharedLogger } from './utils/sharedLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.resolve(__dirname, './config/config.json');
const statePath = path.resolve(__dirname, './config/last_state.json');
const REDIS_STREAM_KEY = 'config:updates';

export async function checkConfigChangesAndPublish() {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const lastState = fs.existsSync(statePath)
      ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
      : null;

    if (JSON.stringify(config) === JSON.stringify(lastState)) {
      await sharedLogger({
        service: 'config_watcher',
        level: 'info',
        message: 'Конфиг не изменился.'
      });
      return;
    }

    await sharedLogger({
      service: 'config_watcher',
      level: 'info',
      message: 'Обнаружены изменения в config.json'
    });

    const payload = {
      target: 'config.json',
      changed: config
    };

    const { valid, missingFields } = validateEvent('CONFIG_UPDATE', payload);
    if (!valid) {
      await sharedLogger({
        service: 'config_watcher',
        level: 'error',
        message: `Ошибка валидации схемы: ${missingFields.join(', ')}`
      });
      return;
    }

    await redisClient.xadd(
      REDIS_STREAM_KEY,
      '*',
      'event',
      JSON.stringify({
        type: 'CONFIG_UPDATE',
        data: payload
      })
    );

    await sharedLogger({
      service: 'config_watcher',
      level: 'info',
      message: 'Конфигурация отправлена в Redis Stream'
    });

    fs.writeFileSync(statePath, JSON.stringify(config, null, 2));

    await sharedLogger({
      service: 'config_watcher',
      level: 'info',
      message: 'last_state.json обновлён'
    });

  } catch (err) {
    await sharedLogger({
      service: 'config_watcher',
      level: 'error',
      message: `Ошибка при сравнении или отправке: ${err.message}`
    });
  }
}
