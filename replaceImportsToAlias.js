import fs from 'fs';
import path from 'path';

const targetDir = './tests/unit';

function walk(dir) {
  let files = [];
  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      files = files.concat(walk(fullPath));
    } else if (file.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

function revertInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  // Откат импорта (заменить '@/services/...' на относительные пути)
  content = content.replace(
    /from\s+['"]@\/(.*?)['"]/g,
    (match, p1) => `from '../../${p1}'`
  );

  // Откат мока
  content = content.replace(
    /vi.mock\(['"]@\/(.*?)['"]/g,
    (match, p1) => `vi.mock('../../${p1}'`
  );

  // Если файл был изменён, записываем
  if (content !== original) {
    console.log(`✔ Откат изменён: ${filePath}`);
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}

const files = walk(targetDir);
for (const file of files) {
  revertInFile(file);
}

console.log('✅ Откат завершён: все моки и импорты восстановлены.');
