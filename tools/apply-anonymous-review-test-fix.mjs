import { readFileSync, writeFileSync } from 'node:fs';

const path = 'web-tests/commands-redesign.test.js';
const source = readFileSync(path, 'utf8');
const before = '  assert.equal(commands.length, 43);';
const after = '  assert.equal(commands.length, 45);';

if (!source.includes(before)) {
  throw new Error(`Review command-count anchor not found in ${path}`);
}

writeFileSync(path, source.replace(before, after));
console.log('Aligned current-site command-count regression for anonymous review.');
