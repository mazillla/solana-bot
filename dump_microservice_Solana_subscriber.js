import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const microserviceDir = path.join(__dirname, 'services', 'solana_subscriber');
const outputFile = path.join(__dirname, 'solana_subscriber_dump.txt');

function getAllJsFiles(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  let files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getAllJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

function dumpFilesToFile(filePaths, outFile) {
  fs.writeFileSync(outFile, '', 'utf-8'); // Очистить файл
  for (const filePath of filePaths) {
    const relative = path.relative(__dirname, filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    fs.appendFileSync(outFile, `\n/${relative}:\n${content}\n`, 'utf-8');
  }
}

const jsFiles = getAllJsFiles(microserviceDir);
dumpFilesToFile(jsFiles, outputFile);

console.log(`✅ Сохранено ${jsFiles.length} файлов в ${outputFile}`);
