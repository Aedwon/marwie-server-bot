import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('Vercel build replaces the generated docs-site output instead of nesting into cached output', () => {
  const build = pkg.scripts?.build || '';
  assert.match(build, /rm -rf public\/docs-site/);
  assert.match(build, /mkdir -p public\/docs-site/);
  assert.match(build, /cp -R docs-site\/\. public\/docs-site\//);
});
