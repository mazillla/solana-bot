import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.resolve(__dirname, '../config/config.json');

let configData = null;

function loadConfig() {
  try {
    const fileContent = fs.readFileSync(configPath, 'utf8');
    configData = JSON.parse(fileContent);

    if (!configData.globals || !configData.schemas) {
      throw new Error("Конфигурация должна содержать 'globals' и 'schemas'");
    }

    console.log('[configManager] Конфигурация успешно загружена.');
  } catch (err) {
    console.error('[configManager] Ошибка при загрузке config.json:', err.message || err);
    process.exit(1);
  }
}

loadConfig();

export function getGlobals() {
  return configData.globals;
}

export function getSchemas() {
  return configData.schemas;
}

export function getSchema(eventName) {
  return configData.schemas[eventName] || null;
}
