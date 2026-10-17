import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { navigationMarkup } from '../docs-site/control-components.js';
import { createNavigationState, navigationModel } from '../docs-site/control-navigation.js';
import { destinationForPath } from '../docs-site/control-router.js';

const controlApp = readFileSync(new URL('../docs-site/control-app.js', import.meta.url), 'utf8');
const controlHtml = readFileSync(new URL('../docs-site/control.html', import.meta.url), 'utf8');
const controlCss = readFileSync(new URL('../docs-site/control.css', import.meta.url), 'utf8');
const featureCss = readFileSync(new URL('../docs-site/control-features.css', import.meta.url), 'utf8');

function sourceBlock(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  assert.ok(startIndex >= 0, `missing source block start: ${start}`);
  assert.ok(endIndex > startIndex, `missing source block end: ${end}`);
  return source.slice(startIndex, endIndex);
}

test('revealing a feature group changes only the revealed menu', () => {
  const state = createNavigationState({ currentPath: '/control/community/reputation' });
  state.revealDomain('publishing');
  assert.equal(state.current.path, '/control/community/reputation');
  assert.equal(state.expandedDomain, 'publishing');
  assert.equal(state.lastByDomain.community, '/control/community/reputation');
});

test('feature-first groups own primary navigation and Playbooks stay secondary', () => {
  const model = navigationModel(destinationForPath('/control/community/reputation'), 'engagement');
  assert.deepEqual(model.primary.map(item => item.key), ['engagement', 'publishing', 'support-safety', 'insights', 'system']);
  assert.deepEqual(model.secondary.map(item => item.path), ['/control/workflows/ticket-handling', '/control/workflows/events']);
});

test('feature-group markup has no disclosure glyph and marks the current destination independently', () => {
  const model = navigationModel(destinationForPath('/control/community/reputation'), 'publishing');
  const markup = navigationMarkup(model);
  assert.doesNotMatch(markup, /⌄/);
  assert.match(markup, /data-domain="engagement"[\s\S]*?aria-current="page"/);
  assert.match(markup, /data-domain="publishing"[\s\S]*?aria-expanded="true"/);
  assert.doesNotMatch(markup, /control-nav-marker/);
  assert.match(markup, /Playbooks/);
});

test('parent clicks reveal only and ordinary route changes do not rebuild navigation', () => {
  const renderBlock = sourceBlock(controlApp, 'function renderNavigation()', 'function resetActivityController()');
  const navigateBlock = sourceBlock(controlApp, 'function navigate(', 'function setStatus(');
  assert.match(renderBlock, /revealNavigationDomain\(button\.dataset\.domainSelect\)/);
  assert.match(controlApp, /navState\.revealDomain\(domainKey\)/);
  assert.doesNotMatch(renderBlock, /navigate\(destination\.path\)/);
  assert.doesNotMatch(navigateBlock, /renderNavigation\(\)/);
});

test('revealing a different section uses the approved reflow hooks only for section changes', () => {
  assert.match(controlApp, /function revealNavigationDomain\(/);
  assert.match(controlApp, /getBoundingClientRect\(\)/);
  assert.match(controlApp, /requestAnimationFrame\(/);
  assert.match(controlApp, /control-nav-reflow/);
  assert.match(controlApp, /control-nav-children-reveal/);
});

test('footer brand and appearance controls match the approved compact presentation', () => {
  assert.match(controlHtml, /<span>Rob-bot Control Panel<\/span>/);
  assert.doesNotMatch(controlHtml, /<span>Rob-bot<small>Control<\/small><\/span>/);
  const start = controlHtml.indexOf('class="control-appearance"');
  const end = controlHtml.indexOf('</div>', start);
  const appearance = controlHtml.slice(start, end);
  assert.doesNotMatch(appearance, />Dark<|>Light<|>System</);
  assert.match(appearance, /aria-label="Dark theme"/);
  assert.match(appearance, /aria-label="Light theme"/);
  assert.match(appearance, /aria-label="Follow system theme"/);
  assert.match(appearance, /<svg[\s\S]*?<\/svg>/);
});

test('canonical shell keeps side regions floating and center workspace flat', () => {
  assert.match(controlCss, /\.control-rail, \.control-context-shell \{[\s\S]*?border-radius: var\(--radius-shell\)/);
  assert.match(controlCss, /\.control-main \{[\s\S]*?padding:/);
  assert.doesNotMatch(controlCss, /--control-card-shadow/);
});

test('feature stylesheet uses flat section rows instead of legacy card grids', () => {
  assert.match(featureCss, /\.control-field-group,[\s\S]*?border-bottom: 1px solid var\(--stroke-subtle\)/);
  assert.match(featureCss, /\.control-list-row \{[\s\S]*?border-bottom:/);
  for (const legacy of ['community-summary-card', 'community-field-card', 'content-admin-surface', 'utility-ticket-grid', 'analytics-stat']) {
    assert.equal(featureCss.includes(legacy), false, legacy);
  }
});

test('canonical feature presentation uses semantic tokens and restrained weights', () => {
  assert.doesNotMatch(featureCss, /font-weight:\s*(?:650|700|750|800|900)/);
  assert.doesNotMatch(featureCss, /#248a3d|#d70015|#30d158|#ff453a/i);
  assert.match(featureCss, /var\(--stroke-subtle\)/);
  assert.match(featureCss, /var\(--text-secondary\)/);
});
