import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ROUTES = [
  '/control/community/reputation',
  '/control/community/quizzes',
  '/control/community/voice-coworking',
  '/control/community/showcase',
  '/control/content/feeds',
  '/control/content/announcements',
  '/control/content/live',
  '/control/utilities/ticket-configuration',
  '/control/utilities/notification-roles',
  '/control/utilities/anonymous-questions',
  '/control/analytics',
  '/control/workflows/moderation',
  '/control/workflows/ticket-handling',
  '/control/workflows/events',
  '/control/mappings/channels',
  '/control/mappings/roles',
  '/control/mappings/categories',
  '/control/commands',
  '/control/activity',
].sort();

const EXPECTED_GROUPS = {
  engagement: [
    '/control/community/reputation',
    '/control/community/quizzes',
    '/control/community/voice-coworking',
    '/control/community/showcase',
    '/control/utilities/notification-roles',
  ],
  publishing: [
    '/control/content/feeds',
    '/control/content/announcements',
    '/control/content/live',
  ],
  'support-safety': [
    '/control/utilities/ticket-configuration',
    '/control/utilities/anonymous-questions',
    '/control/workflows/moderation',
  ],
  insights: ['/control/analytics', '/control/activity'],
};

const EXPECTED_RESOURCES = {
  '/control/community/reputation': ['builder_role', 'contributor_role', 'mentor_role'],
  '/control/community/quizzes': ['quiz_channel'],
  '/control/community/voice-coworking': ['create_workspace_voice', 'coworking_lounge', 'temp_voice_category'],
  '/control/community/showcase': ['showcase_forum', 'app_of_the_week', 'collab_lfg'],
  '/control/utilities/notification-roles': ['role_panel'],
  '/control/content/feeds': ['ai_updates'],
  '/control/content/announcements': ['announcements'],
  '/control/content/live': ['live_announcements', 'live_ping_role'],
  '/control/utilities/ticket-configuration': ['ticket_panel', 'ticket_logs', 'ticket_category'],
  '/control/utilities/anonymous-questions': ['anon_questions'],
  '/control/workflows/moderation': ['moderation_log', 'compromised_account_trap'],
  '/control/analytics': ['analytics'],
};

test('completion keeps all 19 canonical deep links stable', async () => {
  const { CONTROL_DESTINATIONS, destinationForPath } = await import('../docs-site/control-router.js');
  assert.deepEqual(CONTROL_DESTINATIONS.map(item => item.path).sort(), ROUTES);
  for (const path of ROUTES) assert.equal(destinationForPath(path)?.path, path, path);
});

test('navigation is grouped by user-facing feature intent instead of URL families', async () => {
  const { CONTROL_NAV_GROUPS, CONTROL_NAV_RESOURCES, CONTROL_PLAYBOOKS, CONTROL_REFERENCE } = await import('../docs-site/control-router.js');
  assert.deepEqual(Object.fromEntries(CONTROL_NAV_GROUPS.map(group => [group.key, group.items.map(item => item.path)])), EXPECTED_GROUPS);
  assert.deepEqual(CONTROL_NAV_GROUPS.map(group => group.label), ['Engagement', 'Publishing', 'Support & Safety', 'Insights']);
  assert.equal(CONTROL_NAV_RESOURCES.path, '/control/mappings/channels');
  assert.deepEqual(CONTROL_NAV_RESOURCES.matchPaths, ['/control/mappings/channels', '/control/mappings/roles', '/control/mappings/categories']);
  assert.deepEqual(CONTROL_PLAYBOOKS.map(item => item.path), ['/control/workflows/ticket-handling', '/control/workflows/events']);
  assert.deepEqual(CONTROL_REFERENCE.map(item => item.path), ['/commands', '/handbook']);
});

test('wide Control shell is a top bar, a floating sidebar panel and a flat main area with no context column', () => {
  const html = readFileSync(new URL('../docs-site/control.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../docs-site/control.css', import.meta.url), 'utf8');
  for (const id of ['controlTopbar', 'controlNavDrawer', 'controlNavContent', 'controlMain', 'controlMainWrap', 'controlSaveBar']) assert.equal(html.includes(`id="${id}"`), true, id);
  for (const id of ['controlContextDrawer', 'controlContext', 'controlContextButton', 'controlContextClose']) assert.equal(html.includes(`id="${id}"`), false, id);
  assert.match(css, /--nav-w:\s*232px/);
  assert.match(css, /--rail-w:\s*60px/);
  assert.match(css, /--top-h:\s*52px/);
  assert.match(css, /--control-edge-gap:\s*\.75rem/);
  assert.match(css, /--radius-shell:\s*16px/);
  assert.equal(css.includes('@media (min-width: 1200px)'), false);
  assert.equal(css.includes('@media (max-width: 899px)'), false);
  assert.equal(css.includes('@media (max-width: 639px)'), true);
  assert.match(css, /\.control-shell\[data-nav-mode="rail"\] \{ --nav-col: var\(--rail-w\); \}/);
});

test('page registry exposes one optional contextual render path without a second state store', async () => {
  const registry = await import('../docs-site/control-page-registry.js');
  assert.equal(typeof registry.renderRegisteredControlContext, 'function');
  assert.equal(typeof registry.controlState.get, 'function');
  assert.equal('contextState' in registry, false);
});

test('feature resource ownership is explicit and canonical', async () => {
  const contract = await import('../docs-site/control-resource-contract.js');
  assert.deepEqual(contract.FEATURE_RESOURCE_KEYS_BY_PAGE, EXPECTED_RESOURCES);
});

test('feature pages no longer require routine resource detours to Mappings', () => {
  for (const file of ['control-community.js', 'control-content.js', 'control-utilities.js', 'control-analytics.js', 'control-workflows.js']) {
    const source = readFileSync(new URL(`../docs-site/${file}`, import.meta.url), 'utf8');
    assert.equal(/stay(?:s)? in Mappings|Mappings owns these resource connections|Manage mappings/i.test(source), false, file);
  }
});

test('System is the default appearance and Control keeps the canonical Figtree weight range', async () => {
  const { resolveThemePreference } = await import('../docs-site/control-theme.js');
  assert.deepEqual(resolveThemePreference(undefined, false), { preference: 'system', theme: 'light' });
  assert.deepEqual(resolveThemePreference(undefined, true), { preference: 'system', theme: 'dark' });
  const html = readFileSync(new URL('../docs-site/control.html', import.meta.url), 'utf8');
  assert.equal(html.includes('data-preference=\"system\"'), true);
  assert.equal(html.includes('family=Figtree:wght@400;500;600'), true);
});

test('save actions share one floating ink bar at the bottom center of main', () => {
  const shell = readFileSync(new URL('../docs-site/control.css', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../docs-site/control-features.css', import.meta.url), 'utf8');
  const host = shell.match(/\.control-save-host \{([^}]*)\}/)?.[1] || '';
  assert.match(host, /position:\s*absolute/);
  assert.match(host, /bottom:\s*20px/);
  assert.match(host, /left:\s*50%/);
  assert.match(host, /width:\s*min\(480px, calc\(100% - 40px\)\)/);
  assert.match(host, /background:\s*var\(--text-primary\)/);
  assert.match(host, /color:\s*var\(--surface-page\)/);
  assert.match(host, /transition:\s*transform var\(--motion-exit\) var\(--ease-in\)/);
  assert.match(shell, /\.control-save-host:not\(\[data-bar="hidden"\]\) \{[^}]*transition:\s*transform var\(--motion-enter\) var\(--ease-out\)/);
  assert.match(shell, /@keyframes control-save-nudge[\s\S]*?translate\(calc\(-50% - 2px\)[\s\S]*?translate\(calc\(-50% \+ 2px\)/);
  const start = css.indexOf('.control-save-bar,');
  const block = css.slice(start, css.indexOf('.control-save-bar > div,', start));
  assert.match(block, /display:\s*flex/);
  assert.doesNotMatch(block, /position:\s*sticky|backdrop-filter|border-radius/);
  assert.doesNotMatch(css, /\.control-main > \.control-page:has\(\.control-save-bar\)/);
});
