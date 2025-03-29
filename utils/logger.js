// services/logging/logger.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LOG_DIR = path.resolve(__dirname, '../../logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const getLogFilePath = (serviceName) =>
  path.join(LOG_DIR, `${serviceName}.log`);

const log = (level, service, message, extra = {}) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    service,
    message,
    ...extra,
  };

  const line = JSON.stringify(logEntry) + '\n';
  fs.appendFile(getLogFilePath(service), line, (err) => {
    if (err) console.error('Error writing log:', err);
  });
};

const logger = {
  info: (service, msg, extra) => log('info', service, msg, extra),
  warn: (service, msg, extra) => log('warn', service, msg, extra),
  error: (service, msg, extra) => log('error', service, msg, extra),
};

export default logger;
