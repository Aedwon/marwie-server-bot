import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const controlCss = readFileSync(new URL('../docs-site/control.css', import.meta.url), 'utf8');
const controlFeaturesCss = readFileSync(new URL('../docs-site/control-features.css', import.meta.url), 'utf8');
const controlHtml = readFileSync(new URL('../docs-site/control.html', import.meta.url), 'utf8');

test('Control owns its theme surfaces without the handbook stylesheet', () => {
  assert.doesNotMatch(controlHtml, /\/styles\.css/);
  assert.match(controlCss, /--surface-page:\s*#fcfcfb/);
  assert.match(controlCss, /html\[data-theme=["']dark["']\][\s\S]*--surface-page:\s*#0f0f11/);
  assert.match(controlCss, /--surface-primary:\s*#ffffff/);
  assert.doesNotMatch(controlCss, /--page-surface:\s*var\(--surface\)/);
  assert.doesNotMatch(controlCss, /--page-surface-strong:\s*var\(--surface\)/);
  assert.doesNotMatch(controlCss, /--panel:\s*var\(--surface\)/);
  assert.doesNotMatch(controlCss, /--line:\s*var\(--border\)/);
});

test('Control shell stylesheet URL is cache-busted for the current Control surface contract', () => {
  assert.match(controlHtml, /href=["']\/control\.css\?v=29["']/);
});

test('Control module graph cache-busts the save bar change', () => {
  const app = readFileSync(new URL('../docs-site/control-app.js', import.meta.url), 'utf8');
  const community = readFileSync(new URL('../docs-site/control-community.js', import.meta.url), 'utf8');
  assert.match(controlHtml, /src=["']\/control-app\.js\?v=22["']/);
  assert.match(app, /control-components\.js\?v=22/);
  assert.match(app, /control-analytics\.js\?v=20/);
  assert.match(app, /control-mappings\.js\?v=20/);
  assert.match(app, /control-utilities\.js\?v=21/);
  assert.match(app, /control-workflows\.js\?v=20/);
  assert.match(community, /control-components\.js\?v=22/);
});

test('Control hides scrollbars while preserving scroll containers', () => {
  assert.match(controlCss, /scrollbar-width:\s*none/);
  assert.match(controlCss, /::-webkit-scrollbar[^{]*\{[^}]*display:\s*none/s);
});

test('The resource editor uses a responsive three, two, one column grid', () => {
  assert.match(
    controlFeaturesCss,
    /\.mapping-edit-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s,
  );
  assert.match(
    controlFeaturesCss,
    /@container control-main \(max-width: 759px\)\s*\{\s*\.mapping-edit-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s,
  );
  assert.match(
    controlFeaturesCss,
    /@container control-main \(max-width: 559px\)\s*\{\s*\.mapping-edit-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s,
  );
});

test('The notification emoji picker matches the height of other form controls', () => {
  assert.match(
    controlFeaturesCss,
    /\.utility-emoji-image\s*\{[^}]*width:\s*18px[^}]*height:\s*18px/s,
  );
  assert.match(
    controlFeaturesCss,
    /\.utility-emoji-combobox\s*>\s*summary\s*\{[^}]*height:\s*36px/s,
  );
});
