import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const rewrites = new Map(config.rewrites.map(({ source, destination }) => [source, destination]));

test('canonical site root serves the redesigned Control shell', () => {
  assert.equal(rewrites.get('/'), '/docs-site/control');
  assert.equal(rewrites.get('/control'), '/docs-site/control');
  assert.equal(rewrites.get('/control/(.*)'), '/docs-site/control');
});

test('legacy handbook remains available away from the canonical root', () => {
  assert.equal(rewrites.get('/handbook'), '/docs-site/index');
});
