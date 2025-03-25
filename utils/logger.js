// services/logging/logger.js
const fs = require('fs');
const path = require('path');

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

module.exports = {
  info: (service, msg, extra) => log('info', service, msg, extra),
  warn: (service, msg, extra) => log('warn', service, msg, extra),
  error: (service, msg, extra) => log('error', service, msg, extra),
};
