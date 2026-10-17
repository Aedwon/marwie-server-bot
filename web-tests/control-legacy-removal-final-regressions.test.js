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

test('medium Context drawer reserves center workspace width while open', () => {
  assert.match(shellCss, /@media \(min-width: 900px\) and \(max-width: 1199px\)[\s\S]*?\.control-shell:has\(\.control-context-shell\[data-open=\"true\"\]\) \.control-main[\s\S]*?padding-right:\s*calc\(var\(--control-right-width\) \+ 32px\);/);
});

test('mobile pending-changes tray can wrap within safe viewport insets', () => {
  assert.match(shellCss, /\.control-changes-tray-compact\s*\{[\s\S]*?width:\s*auto;[\s\S]*?max-width:\s*100%;[\s\S]*?white-space:\s*normal;/);
});
