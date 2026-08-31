import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { identityMarkup, navigationMarkup } from '../docs-site/control-components.js';
import { createNavigationState, navigationModel } from '../docs-site/control-navigation.js';
import { destinationForPath } from '../docs-site/control-router.js';

const controlApp = readFileSync(new URL('../docs-site/control-app.js', import.meta.url), 'utf8');

function sourceBlock(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  assert.ok(startIndex >= 0, `missing source block start: ${start}`);
  assert.ok(endIndex > startIndex, `missing source block end: ${end}`);
  return source.slice(startIndex, endIndex);
}

test('revealing a primary domain changes only the revealed menu', () => {
  const state = createNavigationState({ currentPath: '/control/community/reputation' });

  state.revealDomain('content');

  assert.equal(state.current.path, '/control/community/reputation');
  assert.equal(state.expandedDomain, 'content');
  assert.equal(state.lastByDomain.community, '/control/community/reputation');
});

test('Analytics is grouped with Commands and Activity instead of primary section switchers', () => {
  const model = navigationModel(
    destinationForPath('/control/community/reputation'),
    'community',
  );

  assert.deepEqual(
    model.primary.map(item => item.key),
    ['community', 'content', 'utilities', 'workflows', 'mappings'],
  );
  assert.deepEqual(
    model.secondary.map(item => item.path),
    ['/control/analytics', '/control/commands', '/control/activity'],
  );
});

test('section-switcher markup has no disclosure glyph and marks the current page domain independently', () => {
  const model = navigationModel(
    destinationForPath('/control/community/reputation'),
    'content',
  );
  const markup = navigationMarkup(model);

  assert.doesNotMatch(markup, /⌄/);
  assert.match(markup, /data-domain="community"[\s\S]*?control-nav-marker/);
  assert.match(markup, /data-domain="content"[\s\S]*?aria-expanded="true"/);
  assert.doesNotMatch(
    markup.match(/data-domain="content"[\s\S]*?<\/section>/)?.[0] || '',
    /control-nav-marker/,
  );
});

test('parent clicks reveal only and ordinary route changes do not rebuild navigation', () => {
  const renderBlock = sourceBlock(
    controlApp,
    'function renderNavigation()',
    'function resetActivityController()',
  );
  const navigateBlock = sourceBlock(
    controlApp,
    'function navigate(',
    'function setStatus(',
  );

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


const controlHtml = readFileSync(new URL('../docs-site/control.html', import.meta.url), 'utf8');
const controlCss = readFileSync(new URL('../docs-site/control.css', import.meta.url), 'utf8');
const communityCss = readFileSync(new URL('../docs-site/control-community.css', import.meta.url), 'utf8');
const contentCss = readFileSync(new URL('../docs-site/control-content.css', import.meta.url), 'utf8');
const utilityCss = readFileSync(new URL('../docs-site/control-utilities.css', import.meta.url), 'utf8');
const analyticsCss = readFileSync(new URL('../docs-site/control-analytics-workflows.css', import.meta.url), 'utf8');
const mappingsCss = readFileSync(new URL('../docs-site/control-mappings.css', import.meta.url), 'utf8');

function cssRule(source, selector) {
  const selectorIndex = source.indexOf(`${selector} {`);
  assert.ok(selectorIndex >= 0, `missing CSS selector: ${selector}`);
  const open = source.indexOf('{', selectorIndex);
  const close = source.indexOf('}', open);
  assert.ok(open > selectorIndex && close > open, `malformed CSS selector: ${selector}`);
  return source.slice(open + 1, close);
}

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

test('approved card-like Control surfaces are borderless and elevated', () => {
  const cardRules = [
    [communityCss, `.community-summary-card,
.community-toggle-row,
.community-field-card,
.community-fieldset,
.community-question-card,
.community-mapping-card`],
    [contentCss, '.content-card'],
    [utilityCss, '.utility-editor-row'],
    [utilityCss, '.utility-save-bar'],
    [analyticsCss, '.analytics-settings'],
    [mappingsCss, `.mapping-row,
.mapping-editor-row,
.mapping-suggestion-item,
.mapping-suggestions`],
  ];

  for (const [source, selector] of cardRules) {
    const rule = cssRule(source, selector);
    assert.doesNotMatch(rule, /border\s*:/, `${selector} keeps a decorative border`);
    assert.match(rule, /box-shadow\s*:/, `${selector} lacks restrained elevation`);
  }
});

test('signed-out Discord login is a centered branded CTA with an inline logo', () => {
  const markup = identityMarkup({ authenticated: false }, null);
  assert.match(markup, /class="control-login"/);
  assert.match(markup, /<svg[^>]*viewBox="0 0 24 24"[^>]*aria-hidden="true"/);
  assert.match(markup, /Sign in with Discord/);

  const loginRule = cssRule(controlCss, '.control-identity > .control-login');
  assert.match(loginRule, /width:\s*100%/);
  assert.match(loginRule, /justify-content:\s*center/);
  assert.match(loginRule, /background:\s*#5865f2/i);
  assert.match(loginRule, /font-weight:\s*700/);
  assert.doesNotMatch(loginRule, /border\s*:/);

  const iconRule = cssRule(controlCss, '.control-login svg');
  assert.match(iconRule, /fill:\s*currentColor/);
});

test('navigation, theme, and action controls expose hover pressed focus and reduced-motion feedback', () => {
  assert.match(controlCss, /control-nav-marker/);
  assert.match(controlCss, /control-nav-reflow[\s\S]*?190ms[\s\S]*?cubic-bezier\(\.2,\s*\.8,\s*\.2,\s*1\)/);
  assert.match(controlCss, /control-nav-children-reveal[\s\S]*?120ms/);
  assert.match(controlCss, /control-nav-domain[^}]*button:active|control-nav-domain[^}]*button:not\(\[disabled\]\):active/);
  assert.match(controlCss, /transform:\s*scale\(\.985\)/);
  assert.match(controlCss, /control-appearance button:hover/);
  assert.match(controlCss, /control-appearance button:active/);
  assert.match(controlCss, /control-appearance button[\s\S]*?42px/);
  assert.match(controlCss, /focus-visible/);
  assert.match(controlCss, /prefers-reduced-motion:\s*reduce/);
});
