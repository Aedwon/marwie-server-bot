import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const controlApp = readFileSync(new URL('../docs-site/control-app.js', import.meta.url), 'utf8');

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


test('initial guild-state failure exits loading state and remains non-actionable', () => {
  assert.match(controlApp, /try\s*\{[\s\S]*loadGuildState\(guild\.id\)[\s\S]*\}\s*catch\s*\(error\)/);
  assert.match(controlApp, /catch\s*\(error\)[\s\S]*guildState\s*=\s*null;[\s\S]*snapshot\s*=\s*null;[\s\S]*setStatus\([^)]*error[^)]*['"]bad['"][^)]*\);[\s\S]*renderMain\(\);[\s\S]*return;/);
});
