import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('notification emoji picker hides the native disclosure marker and keeps the custom chevron', () => {
  const css = readFileSync(new URL('../docs-site/control-utilities.css', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../docs-site/control-utilities.js', import.meta.url), 'utf8');

  assert.match(
    css,
    /\.utility-emoji-combobox\s*>\s*summary::marker\s*\{[^}]*content:\s*["']{2}/s,
  );
  assert.match(source, /class="utility-emoji-chevron"/);
});
