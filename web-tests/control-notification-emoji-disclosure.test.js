import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('notification emoji picker hides the native disclosure marker and keeps the custom chevron', () => {
  const controlHtml = readFileSync(new URL('../docs-site/control.html', import.meta.url), 'utf8');
  const overrideUrl = new URL('../docs-site/control-emoji-picker.css', import.meta.url);
  const features = readFileSync(new URL('../docs-site/control-features.css', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../docs-site/control-utilities.js', import.meta.url), 'utf8');

  assert.doesNotMatch(controlHtml, /control-emoji-picker\.css/);
  assert.equal(existsSync(overrideUrl), false);
  assert.match(
    features,
    /\.utility-emoji-combobox\s*>\s*summary::marker\s*\{[^}]*content:\s*["']{2}/s,
  );
  assert.match(source, /class="utility-emoji-chevron"/);
});
