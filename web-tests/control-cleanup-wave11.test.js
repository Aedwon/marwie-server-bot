import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const OBSOLETE_CONTROL_FILES = [
  'docs-site/control.js',
  'docs-site/control-refine.js',
  'docs-site/control-live.js',
  'docs-site/control-feed-edit.js',
  'docs-site/control-polish.js',
  'docs-site/control-fetch-retry.js',
  'docs-site/control-page-adapter.js',
  'docs-site/control-legacy.css',
];

test('Wave 11 removes replaced prototype Control layers and hidden legacy host', () => {
  for (const file of OBSOLETE_CONTROL_FILES) {
    assert.equal(fs.existsSync(path.join(ROOT, file)), false, `${file} must be deleted`);
  }
  const html = read('docs-site/control.html');
  assert.doesNotMatch(html, /controlLegacyHost|prototypeDialog|control-refine|control-live|control-feed-edit|control-polish|control-fetch-retry/);
  const app = read('docs-site/control-app.js');
  assert.doesNotMatch(app, /control-page-adapter|legacyRoot|allowLegacy|shell\.legacy/);
  const vercel = read('vercel.json');
  assert.doesNotMatch(vercel, /control-polish|control-core/);
});

test('Wave 11 keeps only approved IA routes and one canonical home per capability', () => {
  const router = read('docs-site/control-router.js');
  for (const required of [
    'community', 'content', 'utilities', 'analytics', 'workflows', 'mappings',
    'commands', 'activity', 'reputation', 'quizzes', 'voice-coworking', 'showcase',
    'feeds', 'announcements', 'live', 'ticket-configuration', 'notification-roles',
    'anonymous-questions', 'moderation', 'ticket-handling', 'events',
    'channels', 'roles', 'categories',
  ]) assert.match(router, new RegExp(`['\"]${required}['\"]`));
  assert.doesNotMatch(router, /overview|features|setup|settings|system|advanced|publishing|build-help|message-logs/);
});

test('Commands-only operations are not exposed through the browser action API', () => {
  const actions = read('api/_lib/actions.js');
  assert.doesNotMatch(actions, /REFRESH_TICKET_PANEL|refresh_ticket_panel/);
  assert.doesNotMatch(actions, /ADJUST_REPUTATION|adjust_reputation/);
  assert.doesNotMatch(actions, /POLL_AI_SOURCES|poll_ai_sources/);
});

test('Build Help is absent from live web/config/manual surfaces while Message Logging remains outside Control', () => {
  for (const file of [
    'api/_lib/actions.js',
    'docs-site/control.html',
    'docs-site/control-app.js',
    'docs-site/commands.md',
    'docs/commands.md',
    'README.md',
  ]) {
    assert.doesNotMatch(read(file), /build_help|build-help|Build Help|Build help|solved_tag/i, `${file} still references Build Help`);
  }
  const resources = read('src/marwie_bot/config/resources.py');
  assert.match(resources, /MESSAGE_LOG = \"message_log\"/);
  assert.match(resources, /MESSAGE_LOGS = \"message_logs\"/);
  assert.doesNotMatch(resources, /BUILD_HELP|SOLVED_TAG|build_help|solved_tag/);
  assert.equal(fs.existsSync(path.join(ROOT, 'src/marwie_bot/features/message_logs/cog.py')), true);
  assert.doesNotMatch(read('docs-site/control-router.js'), /message-logs|message_logs/);
});


test('Wave 11 cutover keeps drawer state accessible and touch targets usable', () => {
  const navigation = read('docs-site/control-navigation.js');
  const css = read('docs-site/control.css');
  assert.match(navigation, /const open = \(\) => \{[\s\S]*trigger\.setAttribute\('aria-expanded', 'true'\)/);
  assert.match(navigation, /if \(restoreFocus\) opener\?\.focus\?\.\(\)/);
  assert.match(navigation, /event\.key === 'Escape'/);
  assert.match(css, /\.control-appearance button \{[^}]*min-height: 44px/s);
  assert.match(css, /\.control-menu-button, \.control-nav-close \{[^}]*min-height: 44px/s);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /overflow-wrap: anywhere/);
});
