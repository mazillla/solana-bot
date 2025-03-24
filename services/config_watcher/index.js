import { checkConfigChangesAndPublish } from './watcher.js';
import { logger } from '../../utils/logger.js';

logger.info('[config_watcher] Интервальное слежение за config.json запущено (каждые 10 сек)');

setInterval(() => {
  checkConfigChangesAndPublish();
}, 10_000);
