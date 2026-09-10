import { readFileSync, writeFileSync } from 'node:fs';

const replacements = [
  {
    path: 'web-tests/commands-redesign.test.js',
    before: '  assert.equal(commands.length, 43);',
    after: '  assert.equal(commands.length, 45);',
  },
  {
    path: 'web-tests/commands-r3.test.js',
    before: '  assert.equal(canonical.length, 43);',
    after: '  assert.equal(canonical.length, 45);',
  },
];

for (const { path, before, after } of replacements) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(before)) {
    throw new Error(`Review command-count anchor not found in ${path}`);
  }
  writeFileSync(path, source.replace(before, after));
}

console.log('Aligned current-site command-count regressions for anonymous review.');
