import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const featureCss = readFileSync(new URL('../docs-site/control-features.css', import.meta.url), 'utf8');
const shellCss = readFileSync(new URL('../docs-site/control.css', import.meta.url), 'utf8');

test('empty feature status regions do not render legacy bordered placeholders', () => {
  assert.match(featureCss, /\.content-message:empty,[\s\S]*?\.mapping-page-message:empty\s*\{\s*display:\s*none;/);
});

test('Feeds table rows retain native table geometry instead of field-grid layout', () => {
  assert.doesNotMatch(featureCss, /\.control-field-group,[^{]*\.content-feed-row,[^{]*\{[^}]*display:\s*grid;/);
});

test('Notification role summaries wrap compactly without an auto-width overflow column', () => {
  assert.match(featureCss, /\.utility-notification-button-summary\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\);/);
  assert.match(featureCss, /\.utility-notification-button-summary dl\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(featureCss, /\.utility-notification-button-summary dd\s*\{[\s\S]*?overflow-wrap:\s*anywhere;/);
});

test('Commands column labels use the same grid geometry as command rows', () => {
  assert.match(featureCss, /\.control-command-table-head\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*minmax\(180px, \.9fr\) minmax\(0, 1\.4fr\) auto;/);
});

test('context column reserves its own track and never pads the center workspace', () => {
  assert.match(
    shellCss,
    /\.control-shell\[data-nav-mode=\"rail\"\]\[data-context-mode=\"column\"\] \{[^}]*var\(--control-rail-width\)[^}]*var\(--control-right-width\)/,
  );
  assert.match(
    shellCss,
    /\.control-shell\[data-context-mode=\"drawer\"\] \.control-context-shell \{[^}]*position: fixed;/,
  );
  assert.doesNotMatch(shellCss, /padding-right:\s*calc\(var\(--control-right-width\)/);
});

test('mobile save bar status wraps inside the floating action bar', () => {
  assert.match(featureCss, /\.control-save-bar-status\s*\{[\s\S]*?min-width:\s*0;[\s\S]*?overflow-wrap:\s*anywhere;/);
});
