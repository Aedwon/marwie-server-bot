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

test('top brand and footer appearance controls match the approved compact presentation', () => {
  assert.match(controlHtml, /<span>Rob-bot Control Panel<\/span>/);
  assert.match(controlHtml, /aria-label="Rob-bot Control Panel"/);
  assert.doesNotMatch(controlHtml, /<span>Rob-bot<small>Control<\/small><\/span>/);
  const headStart = controlHtml.indexOf('class="control-rail-head"');
  const headEnd = controlHtml.indexOf('</div>', headStart);
  assert.ok(headStart >= 0 && headEnd > headStart);
  assert.match(controlHtml.slice(headStart, headEnd), /class="control-brand"/);
  const footStart = controlHtml.indexOf('class="control-rail-foot"');
  const footEnd = controlHtml.indexOf('</aside>', footStart);
  assert.ok(footStart >= 0 && footEnd > footStart);
  assert.match(controlHtml.slice(footStart, footEnd), /id="controlIdentity"/);
  assert.match(controlHtml.slice(footStart, footEnd), /class="control-appearance"/);
  const start = controlHtml.indexOf('class="control-appearance"');
  const end = controlHtml.indexOf('</div>', start);
  const appearance = controlHtml.slice(start, end);
  assert.doesNotMatch(appearance, />Dark<|>Light<|>System</);
  assert.match(appearance, /aria-label="Dark theme"/);
  assert.match(appearance, /aria-label="Light theme"/);
  assert.match(appearance, /aria-label="Follow system theme"/);
  assert.match(appearance, /<svg[\s\S]*?<\/svg>/);
});

test('rail footer keeps the account above appearance and opens its menu upward', () => {
  assert.match(controlCss, /\.control-rail-foot \{[^}]*display: grid;/);
  assert.match(controlCss, /\.control-account-menu \{[\s\S]*?bottom: calc\(100% \+ 6px\);/);
  assert.match(controlCss, /data-nav-mode="rail"\] \.control-account-menu \{[\s\S]*?bottom: 0;/);
});

test('canonical shell keeps side regions floating and center workspace flat', () => {
  assert.match(controlCss, /\.control-rail, \.control-context-shell \{[\s\S]*?border-radius: var\(--radius-shell\)/);
  assert.match(controlCss, /\.control-rail \{[^}]*z-index: 2;/);
  assert.match(controlCss, /\.control-main \{[\s\S]*?padding:/);
  assert.doesNotMatch(controlCss, /--control-card-shadow/);
});

test('labeled navigation renders Phosphor icons for groups and destinations', () => {
  const model = navigationModel(destinationForPath('/control/community/reputation'), 'engagement');
  const markup = navigationMarkup(model);
  assert.match(markup, /control-nav-group-icon/);
  assert.match(markup, /control-nav-icon/);
  assert.match(markup, /<svg[^>]*viewBox="0 0 256 256"/);
  assert.match(markup, /data-domain-select="engagement"/);
  assert.match(markup, /control-nav-label/);
});

test('icon rail keeps every destination and removes group disclosures', () => {
  const model = navigationModel(destinationForPath('/control/community/reputation'), 'engagement');
  const markup = navigationMarkup(model, { rail: true });
  assert.match(markup, /control-primary-nav-rail/);
  assert.doesNotMatch(markup, /data-domain-select/);
  assert.doesNotMatch(markup, /control-nav-marker/);
  assert.match(markup, /aria-label="Reputation"/);
  assert.match(markup, /aria-label="Ticket handling"/);
  assert.match(markup, /aria-current="page"/);
  assert.match(markup, /<svg[^>]*viewBox="0 0 256 256"/);
  assert.doesNotMatch(markup, /control-nav-label">Reputation/);
});

test('shell markup has one navigation toggle and state-driven context triggers', () => {
  assert.match(controlHtml, /id="controlNavToggle"/);
  assert.match(controlHtml, /id="controlNavToggle"[\s\S]*?M216,40H40A16,16,0/);
  assert.match(controlHtml, /control-nav-toggle-icon/);
  assert.doesNotMatch(controlHtml, /control-nav-toggle-icon-expanded|control-nav-toggle-icon-collapsed/);
  assert.match(controlHtml, /data-nav-mode="expanded"/);
  assert.match(controlHtml, /data-context-mode="none"/);
  assert.match(controlHtml, /data-context-trigger="topbar"/);
  assert.match(controlApp, /installShellLayout/);
  assert.match(controlApp, /writeNavPreference/);
  assert.doesNotMatch(controlApp, /NAV_QUERY|CONTEXT_QUERY|navMedia|contextMedia/);
});

test('status pills and the current navigation group use text only, without leading dots', () => {
  assert.doesNotMatch(controlCss, /\.control-state-chip::before/);
  assert.doesNotMatch(controlCss, /\.control-nav-marker/);
  const currentStateBlock = sourceBlock(controlApp, 'function syncNavigationCurrentState()', 'function revealNavigationDomain(');
  assert.doesNotMatch(currentStateBlock, /control-nav-marker/);
});

test('drawer modes open one drawer at a time and close ignores non-drawer state', () => {
  const navigation = readFileSync(new URL('../docs-site/control-navigation.js', import.meta.url), 'utf8');
  assert.match(navigation, /const wasOpen = openedAsDrawer;\n    if \(!wasOpen\) return;/);
  assert.match(controlApp, /onOpen: \(\) => contextDrawer\?\.close\(\{ restoreFocus: false \}\)/);
  assert.match(controlApp, /onOpen: \(\) => navDrawer\?\.close\(\{ restoreFocus: false \}\)/);
});

test('shell styles expose the rail and use center container queries', () => {
  assert.match(controlCss, /--control-rail-width: 4rem;/);
  assert.match(controlCss, /--control-center-min: 37.5rem;/);
  assert.match(controlCss, /container-type: inline-size;/);
  assert.match(controlCss, /container-name: control-main;/);
  assert.doesNotMatch(controlCss, /@media \(min-width: 900px\) and \(max-width: 1199px\)/);
  assert.doesNotMatch(controlCss, /@media \(min-width: 1200px\)/);
  assert.match(featureCss, /@container control-main \(max-width: 720px\)/);
  assert.match(featureCss, /@container control-main \(min-width: 760px\)/);
  assert.match(controlCss, /\.control-shell\[data-context-mode="drawer"\] \.control-context-shell \{ inset: 0; width: auto; height: auto;/);
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
