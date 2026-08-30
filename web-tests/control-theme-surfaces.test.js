import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const controlCss = readFileSync(new URL('../docs-site/control.css', import.meta.url), 'utf8');
const stylesCss = readFileSync(new URL('../docs-site/styles.css', import.meta.url), 'utf8');
const controlHtml = readFileSync(new URL('../docs-site/control.html', import.meta.url), 'utf8');

test('Control bridges its legacy surface tokens to the handbook theme palette', () => {
  assert.match(stylesCss, /html\[data-theme=["']dark["']\][\s\S]*--surface:\s*#1c1c1e/);
  assert.match(controlCss, /--page-surface:\s*var\(--surface\)/);
  assert.match(controlCss, /--page-surface-strong:\s*var\(--surface\)/);
  assert.match(controlCss, /--panel:\s*var\(--surface\)/);
  assert.match(controlCss, /--line:\s*var\(--border\)/);
});

test('Control shell stylesheet URL is cache-busted for the current Control surface contract', () => {
  assert.match(controlHtml, /href=["']\/control\.css\?v=6["']/);
});
