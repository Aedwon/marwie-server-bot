import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const controlHtml = readFileSync(
  new URL('../docs-site/control.html', import.meta.url),
  'utf8',
);

test('programmatic Control main focus does not draw a page-sized focus ring', () => {
  assert.match(
    controlHtml,
    /<main[^>]*id=["']controlMain["'][^>]*tabindex=["']-1["'][^>]*>/,
  );
  assert.match(
    controlHtml,
    /#controlMain:focus-visible\s*\{\s*outline:\s*none;\s*\}/,
  );
});
