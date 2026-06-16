import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC_ROOT = join(__dirname, '../src');
const LITERAL = /['"]faction-player['"]/;

function collectSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
    if (entry.isFile() && entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('player faction audit', () => {
  it('no mobile source file references faction-player literal', () => {
    const offenders = collectSourceFiles(SRC_ROOT).filter((file) =>
      LITERAL.test(readFileSync(file, 'utf8')),
    );

    expect(offenders).toEqual([]);
  });
});
