// services/logging/log_writer_service.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from 'redis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const redis = createClient({ url: 'redis://redis:6379' });
await redis.connect();

const LOG_STREAM = 'logs:stream';
const GROUP = 'log_writer_group';
const CONSUMER = `consumer-${Date.now()}`;
const LOG_DIR = path.resolve(__dirname, './logs');  // Путь поправлен

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

try {
  await redis.xGroupCreate(LOG_STREAM, GROUP, '0', { MKSTREAM: true });
  console.log(`[log_writer] Группа ${GROUP} создана.`);
} catch (e) {
  if (!e.message.includes('BUSYGROUP')) {
    console.error('[log_writer] Ошибка при создании группы:', e);
    process.exit(1);
  }
}

console.log('[log_writer] Старт чтения логов из Redis Stream...');

while (true) {
  try {
    const response = await redis.xReadGroup(
      GROUP,
      CONSUMER,
      { key: LOG_STREAM, id: '>' },
      { COUNT: 10, BLOCK: 5000 }
    );

    if (response && Array.isArray(response)) {
      for (const stream of response) {
        if (stream && Array.isArray(stream.messages)) {
          for (const { id, message: fields } of stream.messages) {
            try {
              const logData = JSON.parse(fields.data);
              const { service, level, timestamp, message } = logData;

              const logLine = JSON.stringify({ timestamp, level, message }) + '\n';
              const logFile = path.resolve(LOG_DIR, `${service}.log`);

              fs.appendFileSync(logFile, logLine);
              console.log(`[log_writer] Записан лог в файл ${logFile}`);

              await redis.xAck(LOG_STREAM, GROUP, id);
            } catch (parseError) {
              console.error('[log_writer] Ошибка при обработке сообщения:', parseError.message);
            }
          }
        }
      }
    } else {
      console.log('[log_writer] Нет новых логов в Redis Stream...');
    }
  } catch (err) {
    console.error('[log_writer] Ошибка при чтении логов:', err.message || err);
    await new Promise(r => setTimeout(r, 1000));
  }
}
