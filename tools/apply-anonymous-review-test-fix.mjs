import { readFileSync, writeFileSync } from 'node:fs';

for (const path of [
  'web-tests/commands-redesign.test.js',
  'web-tests/commands-r3.test.js',
]) {
  const source = readFileSync(path, 'utf8');
  const before = '  assert.equal(commands.length, 43);';
  const after = '  assert.equal(commands.length, 45);';

  if (!source.includes(before)) {
    throw new Error(`Review command-count anchor not found in ${path}`);
  }

  writeFileSync(path, source.replace(before, after));
}

console.log('Aligned current-site command-count regressions for anonymous review.');
