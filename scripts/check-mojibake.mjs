import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const checkedRoots = ['src', 'README.md', 'NEXT_STEPS.md', 'IMPLEMENTATION_PLAN.md'];
const ignoredDirs = new Set(['node_modules', '.next', '.git']);
const mojibakePatterns = [
  /�/,
  /锟/,
  /鈥/,
  /鈧/,
  /閳/,
  /閻/,
  /閺/,
  /閸/,
  /闁/,
  /鐩/,
  /诲/,
  /姒/,
  /鏇/,
  /闃/,
  /鐘/,
  /楠/,
  /乣/,
  /沗/,
  /€\?/,
];
const checkedExtensions = new Set(['.ts', '.tsx', '.md']);

function extensionOf(path) {
  const index = path.lastIndexOf('.');
  return index === -1 ? '' : path.slice(index);
}

function collectFiles(path) {
  const absolutePath = join(root, path);
  const stat = statSync(absolutePath);

  if (stat.isFile()) {
    return checkedExtensions.has(extensionOf(path)) ? [path] : [];
  }

  return readdirSync(absolutePath).flatMap((entry) => {
    if (ignoredDirs.has(entry)) {
      return [];
    }

    return collectFiles(join(path, entry));
  });
}

const offenders = checkedRoots
  .flatMap(collectFiles)
  .filter((file) => {
    const content = readFileSync(join(root, file), 'utf8');
    return content.charCodeAt(0) === 0xfeff || mojibakePatterns.some((pattern) => pattern.test(content));
  });

if (offenders.length > 0) {
  console.error('Possible mojibake found in:');
  for (const file of offenders) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log('No obvious mojibake found in checked source/docs.');
