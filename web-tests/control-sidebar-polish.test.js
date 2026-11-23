import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { navigationMarkup } from '../docs-site/control-shell.js';
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

test('feature-first groups own primary navigation; Resources, Playbooks and Reference follow', () => {
  const model = navigationModel(destinationForPath('/control/community/reputation'), 'engagement');
  assert.deepEqual(model.items.filter(item => item.type === 'group').map(item => item.key), ['engagement', 'publishing', 'support-safety', 'insights']);
  assert.deepEqual(
    model.items.filter(item => item.type === 'link' && item.key !== 'resources' && !item.external).map(item => item.path),
    ['/control/overview', '/control/workflows/ticket-handling', '/control/workflows/events'],
  );
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

test('group clicks only toggle the accordion and route changes never rebuild navigation', () => {
  const shell = readFileSync(new URL('../docs-site/control-shell.js', import.meta.url), 'utf8');
  const navigateBlock = sourceBlock(controlApp, 'function navigate(', 'function setStatus(');
  const clickBlock = sourceBlock(shell, "nav.addEventListener('click'", '/* Layout, rail toggle, peek */');
  assert.match(clickBlock, /setOpen\(openGroup === key \? '' : key\)/);
  assert.match(clickBlock, /indicator\.track\(\)/);
  assert.doesNotMatch(clickBlock, /innerHTML/);
  assert.doesNotMatch(navigateBlock, /navigationMarkup|innerHTML/);
  assert.doesNotMatch(shell, /nav\.innerHTML\s*=/);
  assert.match(navigateBlock, /shellController\?\.setCurrent\(navState\.current\.path\)/);
});

test('accordion and indicator motion are CSS and layout sampling, not FLIP reflow of sections', () => {
  const shell = readFileSync(new URL('../docs-site/control-shell.js', import.meta.url), 'utf8');
  assert.match(shell, /animation\.transitionProperty === 'grid-template-rows'/);
  assert.match(shell, /getBoundingClientRect\(\)/);
  assert.match(shell, /nav\.getAnimations\?\.\(\{ subtree: true \}\)/);
  assert.doesNotMatch(controlApp, /control-nav-reflow|control-nav-children-reveal|revealNavigationDomain/);
  assert.match(controlCss, /\.control-nav-kids \{[^}]*grid-template-rows: 0fr;[^}]*transition: grid-template-rows var\(--motion-enter\) var\(--ease-out\)/s);
  assert.match(controlCss, /\.control-nav-group\[data-open="true"\] > \.control-nav-kids \{ grid-template-rows: 1fr; \}/);
  assert.match(controlCss, /\.control-nav-indicator \{[^}]*transition: transform var\(--motion-enter\) var\(--ease-out\)/s);
});

test('the sidebar head holds the server switcher and toggle; the profile row sits in its foot', () => {
  assert.doesNotMatch(controlHtml, /Rob-bot Control Panel|control-brand|control-rail-head|control-rail-foot|control-appearance/);
  const head = controlHtml.slice(controlHtml.indexOf('<div class="control-side-head">'), controlHtml.indexOf('<div class="control-side-search">'));
  assert.ok(head.indexOf('id="controlServerButton"') >= 0 && head.indexOf('id="controlServerButton"') < head.indexOf('id="controlNavToggle"'));
  const foot = controlHtml.slice(controlHtml.indexOf('<div class="control-side-foot"'), controlHtml.indexOf('</aside>'));
  assert.match(foot, /id="controlAccountButton"[^>]*>[\s\S]*class="control-avatar"[\s\S]*class="control-account-name"[\s\S]*class="control-account-sub"/);
  const account = controlHtml.slice(controlHtml.indexOf('id="controlAccountMenu"'), controlHtml.indexOf('id="controlServerMenu"'));
  assert.match(account, /class="control-seg"/);
  assert.match(account, />Light<\/button>/);
  assert.match(account, />Dark<\/button>/);
  assert.match(account, />Auto<\/button>/);
  assert.match(account, /data-account-sign-out/);
});

test('menus are popovers that fade and rise with the motion tokens; the account menu opens upward from the foot', () => {
  assert.match(controlCss, /\.control-pop \{[^}]*position: fixed;/s);
  assert.match(controlCss, /\.control-pop\[data-open="true"\] \{[^}]*transition: opacity var\(--motion-enter\) var\(--ease-out\), transform var\(--motion-enter\) var\(--ease-out\)/s);
  const account = readFileSync(new URL('../docs-site/control-account.js', import.meta.url), 'utf8');
  assert.match(account, /menu\.style\.top = `\$\{Math\.round\(rect\.bottom \+ 6\)\}px`/);
  assert.match(account, /menu\.style\.bottom = `\$\{Math\.round\(\(globalThis\.innerHeight \|\| 0\) - rect\.top \+ 6\)\}px`/);
  assert.match(account, /installPopover\(\{ trigger, menu, align: 'up'/);
});

test('canonical shell keeps the sidebar panel floating and the main area flat', () => {
  assert.match(controlCss, /\.control-panel \{[\s\S]*?border-radius: var\(--radius-shell\)/);
  assert.match(controlCss, /\.control-panel \{[\s\S]*?box-shadow: var\(--shadow-shell\)/);
  // No top bar on wide screens: the page title lines up with the sidebar's server row.
  assert.match(controlCss, /\.control-main \{[\s\S]*?padding: 16px 40px 140px;/);
  assert.doesNotMatch(controlCss, /--control-card-shadow/);
  assert.doesNotMatch(controlCss, /\.control-rail \{[^}]*box-shadow/);
});

test('labeled navigation renders Phosphor icons for groups and top-level items only', () => {
  const model = navigationModel(destinationForPath('/control/community/reputation'), 'engagement');
  const markup = navigationMarkup(model);
  assert.match(markup, /control-nav-group-icon/);
  assert.match(markup, /control-nav-icon/);
  assert.match(markup, /<svg[^>]*viewBox="0 0 256 256"/);
  assert.match(markup, /data-domain-select="engagement"/);
  assert.match(markup, /control-nav-lbl/);
});

test('the rail is the same DOM as the expanded sidebar: labels fade out and icons keep their x position', () => {
  const model = navigationModel(destinationForPath('/control/community/reputation'), 'engagement');
  const markup = navigationMarkup(model);
  assert.equal(navigationMarkup(model, { rail: true }), markup);
  assert.doesNotMatch(markup, /control-primary-nav-rail|sr-only/);
  assert.match(markup, /data-domain-select/);
  assert.match(markup, /aria-current="page"/);
  assert.match(controlCss, /data-nav-mode="rail"\]:not\(\[data-peek="true"\]\) :is\(\.control-nav-lbl, \.control-nav-chev, \.control-nav-label, \.control-nav-flag\) \{ opacity: 0; pointer-events: none; \}/);
  assert.match(controlCss, /\.control-shell\[data-nav-mode="rail"\] \{ --nav-col: var\(--rail-w\); \}/);
  assert.match(controlCss, /\.control-nav-row \{[^}]*padding: 0 12px;/s);
});

test('shell markup has one navigation toggle and no context triggers', () => {
  assert.match(controlHtml, /id="controlNavToggle"/);
  assert.match(controlHtml, /id="controlNavToggle"[\s\S]*?M216,40H40A16,16,0/);
  assert.equal((controlHtml.match(/id="controlNavToggle"/g) || []).length, 1);
  assert.match(controlHtml, /data-nav-mode="expanded"/);
  assert.doesNotMatch(controlHtml, /data-context-mode|data-context-trigger/);
  assert.match(controlApp, /installShell\(/);
  assert.doesNotMatch(controlApp, /NAV_QUERY|CONTEXT_QUERY|navMedia|contextMedia|installContextDrawerController/);
  const shell = readFileSync(new URL('../docs-site/control-shell.js', import.meta.url), 'utf8');
  assert.match(shell, /installShellLayout/);
  assert.match(shell, /writeNavPreference/);
});

test('status pills and the current navigation row use text only, without leading dots', () => {
  assert.doesNotMatch(controlCss, /\.control-state-chip::before/);
  assert.doesNotMatch(controlCss, /\.control-nav-marker/);
  assert.doesNotMatch(featureCss, /control-save-bar-dot/);
});

test('drawer modes open one drawer at a time and close ignores non-drawer state', () => {
  const navigation = readFileSync(new URL('../docs-site/control-navigation.js', import.meta.url), 'utf8');
  assert.match(navigation, /const wasOpen = openedAsDrawer;\n    if \(!wasOpen\) return;/);
  assert.match(navigation, /setBackgroundInert\(true\)/);
  assert.match(navigation, /setBackgroundInert\(false\)/);
  assert.doesNotMatch(controlApp, /contextDrawer/);
});

test('rail rows fit the rail panel and the panel clips them', () => {
  assert.match(controlCss, /\.control-panel \{[^}]*overflow: hidden;/s);
  assert.match(controlCss, /\.control-nav \{[^}]*padding: 8px;/s);
  assert.match(controlCss, /--rail-w: 60px;/);
});

test('the shell installs hover peek without saving a preference', () => {
  const shell = readFileSync(new URL('../docs-site/control-shell.js', import.meta.url), 'utf8');
  assert.match(shell, /installNavHoverExpand/);
  const hoverBlock = sourceBlock(shell, 'const hover = installNavHoverExpand(', '/* Drawer */');
  assert.doesNotMatch(hoverBlock, /writeNavPreference/);
  assert.match(hoverBlock, /setPeek\(true\)/);
  assert.match(controlCss, /\.control-shell\[data-nav-mode="rail"\]\[data-peek="true"\] \.control-panel \{[^}]*width: var\(--nav-w\)/s);
});

test('rail motion animates the shell grid and the panel width with the layout and peek tokens', () => {
  assert.match(controlCss, /\.control-shell \{[^}]*transition: grid-template-columns var\(--motion-layout\) var\(--ease-out\)/s);
  assert.match(controlCss, /\.control-panel \{[^}]*transition: width var\(--motion-exit\) var\(--ease-in\)/s);
  assert.match(controlCss, /\[data-peek="true"\] \.control-panel \{[^}]*transition: width var\(--motion-enter\) var\(--ease-out\)/s);
  assert.doesNotMatch(controlCss, /control-nav-enter|data-nav-motion/);
  assert.match(controlCss, /prefers-reduced-motion: reduce[\s\S]*?\.control-nav-kids[\s\S]*?transition: none !important/);
});

test('shell styles expose the rail and use center container queries', () => {
  assert.match(controlCss, /--rail-w: 60px;/);
  assert.match(controlCss, /--control-center-min: 37.5rem;/);
  assert.match(controlCss, /container-type: inline-size;/);
  assert.match(controlCss, /container-name: control-main;/);
  assert.doesNotMatch(controlCss, /@media \(min-width: 900px\) and \(max-width: 1199px\)/);
  assert.doesNotMatch(controlCss, /@media \(min-width: 1200px\)/);
  assert.match(featureCss, /@container control-main \(max-width: 720px\)/);
  assert.match(featureCss, /@container control-main \(min-width: 760px\)/);
  assert.doesNotMatch(controlCss, /control-context-shell/);
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
