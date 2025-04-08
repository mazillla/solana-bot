import { checkConfigChangesAndPublish } from './watcher.js';
import { sharedLogger } from './utils/sharedLogger.js';

await sharedLogger({
  service: 'config_watcher',
  level: 'info',
  message: 'Интервальное слежение за config.json запущено (каждые 10 сек)'
});

setInterval(() => {
  checkConfigChangesAndPublish();
}, 10_000);
