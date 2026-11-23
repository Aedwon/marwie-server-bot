import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { controlPageHeaderMarkup } from '../docs-site/control-components.js';
import * as secondary from '../docs-site/control-secondary.js';
import { registerCommunityPages } from '../docs-site/control-community.js';
import { registerContentPages } from '../docs-site/control-content.js';
import { registerUtilitiesPages } from '../docs-site/control-utilities.js';
import { registerAnalyticsPage } from '../docs-site/control-analytics.js';
import { registerWorkflowPages, workflowPageMarkup } from '../docs-site/control-workflows.js';
import { registerMappingPages } from '../docs-site/control-mappings.js';
import {
  controlState,
  hydrateControlPages,
  renderRegisteredControlContext,
  renderRegisteredControlPage,
} from '../docs-site/control-page-registry.js';
import {
  CONTROL_FEATURE_ROUTES,
  controlRouteRevisions,
  controlRouteSnapshot,
} from './fixtures/control-route-snapshot.js';

registerCommunityPages();
registerContentPages();
registerUtilitiesPages();
registerAnalyticsPage();
registerWorkflowPages();
registerMappingPages();

const snapshot = controlRouteSnapshot();
hydrateControlPages(snapshot, controlRouteRevisions());

const READ_EXPECTATIONS = {
  '/control/community/reputation': ['Reputation', 'Award reputation', 'Builder', 'Mentor', 'pts', 'Roles'],
  '/control/community/quizzes': ['Quizzes', 'Post quizzes on a schedule', 'Posts every', 'Channels', 'Questions', 'What does len return?', 'In rotation', 'Paused'],
  '/control/community/voice-coworking': ['Voice &amp; Coworking', 'Create voice rooms', 'Join to create', 'New rooms go in', 'Coworking lounge'],
  '/control/community/showcase': ['Showcase', 'Run showcase spotlights', 'Showcase forum', 'App of the week', 'Collaboration / LFG'],
  '/control/utilities/notification-roles': ['Notification roles', 'Preview', 'Builder updates', 'Panel title', 'Role panel', 'Buttons'],
  '/control/content/feeds': ['Feeds', 'Check feeds', 'Sources', 'OpenAI', 'AI updates', 'Channels'],
  '/control/content/announcements': ['Announcements', 'Send announcements from Control', 'Destination', 'Send announcement', 'Preview'],
  '/control/content/live': ['Live', 'Post live notices', 'Posts to', 'Ping role', 'Post live notice'],
  '/control/utilities/ticket-configuration': ['Tickets', 'Open tickets from the panel', 'Ticket types', 'Support', 'Report', 'Ticket panel', 'Ticket logs', 'Ticket category'],
  '/control/utilities/anonymous-questions': ['Anonymous Questions', 'Accept anonymous questions', 'Anonymous questions'],
  '/control/workflows/moderation': ['Moderation', 'Log moderation actions', 'Moderation log', 'Compromised account trap', 'How moderation works', 'Prepare'],
  '/control/analytics': ['Analytics', 'Moderation cases', 'Post the weekly report', 'Posts to'],
};

// Converted pages edit in place: they have no separate read view.
const CONVERTED_ROUTES = new Set([
  '/control/community/reputation',
  '/control/community/quizzes',
  '/control/community/voice-coworking',
  '/control/community/showcase',
  '/control/utilities/notification-roles',
  '/control/content/feeds',
  '/control/content/announcements',
  '/control/content/live',
  '/control/utilities/ticket-configuration',
  '/control/utilities/anonymous-questions',
  '/control/workflows/moderation',
  '/control/analytics',
  '/control/mappings/channels',
  '/control/mappings/roles',
  '/control/mappings/categories',
]);

const EDIT_EXPECTATIONS = {
  '/control/community/reputation': ['Builder', 'Save changes', 'Discard'],
  '/control/community/quizzes': ['Questions', 'Add question', 'Save changes'],
  '/control/community/voice-coworking': ['Save changes', 'Discard'],
  '/control/community/showcase': ['Save changes', 'Discard'],
  '/control/utilities/notification-roles': ['Buttons', 'Add button', 'Preview', 'Save changes'],
  '/control/content/feeds': ['Sources', 'Add source', 'Save changes'],
  '/control/content/announcements': ['Send announcement', 'More options'],
  '/control/content/live': ['Post live notice'],
  '/control/utilities/ticket-configuration': ['Ticket types', 'Add ticket type', 'Save changes'],
  '/control/utilities/anonymous-questions': ['Save changes', 'Discard'],
  '/control/workflows/moderation': ['How moderation works', 'Save changes'],
  '/control/analytics': ['Moderation cases', 'Save changes'],
};

const CONTEXT_EXPECTATIONS = {};

const NO_CONTEXT_ROUTES = [
  '/control/mappings/channels',
  '/control/mappings/roles',
  '/control/mappings/categories',
];

function assertContains(markup, fragments, label) {
  for (const fragment of fragments) {
    assert.ok(markup.includes(fragment), `${label} must contain ${JSON.stringify(fragment)}`);
  }
}

test('every feature route renders operational content in read mode', () => {
  for (const pageKey of CONTROL_FEATURE_ROUTES) {
    const markup = renderRegisteredControlPage(pageKey, { snapshot });
    assert.ok(markup, `${pageKey} must render`);
    assertContains(markup, READ_EXPECTATIONS[pageKey], `${pageKey} read mode`);
    assert.doesNotMatch(markup, /\bMappings\b/, `${pageKey} must not send the operator to Mappings`);
    assert.doesNotMatch(markup, /control-state-chip/, `${pageKey} must not render a state chip`);
    if (CONVERTED_ROUTES.has(pageKey)) {
      assert.doesNotMatch(markup, /Edit settings|data-community-edit|data-content-edit|data-utility-edit|data-workflow-edit|control-feature-header-actions/, `${pageKey} edits in place`);
      assert.doesNotMatch(markup, /data-control-details|control-context-section/, `${pageKey} has no Details or context`);
      assert.equal(controlState.get(pageKey).mode, 'edit', `${pageKey} enters edit state when hydrated`);
      assert.equal(renderRegisteredControlContext(pageKey, { snapshot }), '', `${pageKey} renders no context`);
    }
  }
});

test('every feature route renders its editable fields in edit mode', () => {
  for (const pageKey of CONTROL_FEATURE_ROUTES) {
    if (pageKey === '/control/utilities/notification-roles') {
      controlState.beginEdit(pageKey);
    } else {
      controlState.beginEdit(pageKey);
    }
    const markup = renderRegisteredControlPage(pageKey, { snapshot });
    assert.ok(markup, `${pageKey} must render in edit mode`);
    assertContains(markup, EDIT_EXPECTATIONS[pageKey], `${pageKey} edit mode`);
    assert.match(markup, /class="[^"]*control-save-bar[^"]*"/, `${pageKey} must use the shared floating save bar`);
    assert.match(markup, /data-save-bar-status/, `${pageKey} must show pending changes in the save bar`);
    assert.match(markup, /Save changes/, `${pageKey} must expose Save changes`);
    assert.match(markup, /Discard/, `${pageKey} must expose Discard`);
    controlState.discard(pageKey);
    if (!CONVERTED_ROUTES.has(pageKey)) controlState.get(pageKey).mode = 'read';
    else assert.equal(controlState.get(pageKey).mode, 'edit');
  }
});

test('notification roles has no master switch and no Edit settings', () => {
  const page = renderRegisteredControlPage('/control/utilities/notification-roles', { snapshot });
  assert.doesNotMatch(page, /Edit settings|control-feature-toggle|data-master-row|data-master=/);
});

test('feature routes expose page-specific context and no generic-only panel', () => {
  for (const [pageKey, fragments] of Object.entries(CONTEXT_EXPECTATIONS)) {
    const markup = renderRegisteredControlContext(pageKey, { snapshot });
    assertContains(markup, fragments, `${pageKey} context`);
    assert.match(markup, /control-context-section/, `${pageKey} context must use sections`);
    assert.doesNotMatch(markup, /<h2>Discord resources<\/h2>/, `${pageKey} context must not repeat the generic resource panel`);
    if (pageKey !== '/control/content/announcements') {
      assert.ok(markup.length > 300, `${pageKey} context must carry meaningful detail`);
    }
  }
});

test('summary tables expose labels for stacked mobile rows', () => {
  const mappings = renderRegisteredControlPage('/control/mappings/channels', { snapshot });
  assert.match(mappings, /<th scope="col">Used for<\/th>/);
  assert.match(mappings, /<th scope="row"><label class="mapping-used-for"/);
});

test('converted Insights and Resources pages render no context panel in edit state', () => {
  for (const pageKey of ['/control/analytics', '/control/mappings/channels']) {
    controlState.beginEdit(pageKey);
    assert.equal(renderRegisteredControlContext(pageKey, { snapshot }), '', `${pageKey} edit context must be empty`);
  }
});

test('system routes render without a contextual column', () => {
  for (const pageKey of NO_CONTEXT_ROUTES) {
    assert.equal(renderRegisteredControlContext(pageKey, { snapshot }), '', `${pageKey} must have no context`);
    const markup = renderRegisteredControlPage(pageKey, { snapshot });
    assert.match(markup, /<h1[^>]*>Resources<\/h1>/, `${pageKey} must render the Resources header`);
  }
  assert.equal(renderRegisteredControlContext('/control/activity', { snapshot }), '');
  assert.equal(secondary.commandsPageMarkup, undefined, 'Commands has no Control page; /commands is the single reference');
  const activity = secondary.activityPageMarkup({
    phase: 'ready',
    actorId: '301',
    items: [{
      summary: 'Changed Reputation thresholds',
      actor: { id: '301' },
      status: 'completed',
      timestamp: '2026-10-20T10:00:00+00:00',
    }],
    nextCursor: null,
  });
  assertContains(activity, ['Activity', 'Changed Reputation thresholds'], 'Activity');
  assert.doesNotMatch(activity, /Completed|data-task-indicator/);
});

test('guidance playbooks keep the shared header and step anatomy', () => {
  for (const [pageKey, title] of [
    ['/control/workflows/ticket-handling', 'Ticket handling'],
    ['/control/workflows/events', 'Events'],
  ]) {
    const markup = workflowPageMarkup(pageKey);
    assertContains(markup, [title, 'Prepare', 'workflow-step', 'control-page-header'], `${pageKey} playbook`);
    assert.doesNotMatch(markup, /Save changes|Edit settings/);
  }
});

test('notification roles never prints raw style enums as visible text', () => {
  const markup = renderRegisteredControlPage('/control/utilities/notification-roles', { snapshot });
  assert.match(markup, /<option value="primary" selected>Primary<\/option>/);
  assert.match(markup, /<option value="secondary" selected>Secondary<\/option>/);
  assert.doesNotMatch(markup, />primary<|>secondary</);
});

test('Analytics no longer duplicates the report resource table in the center', () => {
  const markup = renderRegisteredControlPage('/control/analytics', { snapshot });
  assert.doesNotMatch(markup, /analytics-reporting-table/);
  assert.doesNotMatch(markup, /Report channel/);
  assert.equal(renderRegisteredControlContext('/control/analytics', { snapshot }), '');
});

test('the shell declares nav mode and peek state and has no context column', () => {
  const html = readFileSync(new URL('../docs-site/control.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../docs-site/control.css', import.meta.url), 'utf8');
  const features = readFileSync(new URL('../docs-site/control-features.css', import.meta.url), 'utf8');

  assert.doesNotMatch(html, /styles\.css/);
  assert.doesNotMatch(html, /control-emoji-picker\.css/);
  assert.match(html, /class="control-shell" data-nav-mode="expanded" data-peek="false"/);
  assert.doesNotMatch(html, /data-context/);
  assert.match(css, /\.control-shell\[data-nav-mode="rail"\]\[data-peek="true"\] \.control-panel/);
  assert.match(css, /\.control-shell\[data-nav-mode="drawer"\] \.control-rail/);
  assert.match(css, /\.sr-only/);
  assert.match(features, /font-size: 24px/);
  assert.match(features, /font-size: 18px/);
  assert.match(css, /grid-template-columns: var\(--nav-col\) minmax\(0, 1fr\)/);
  assert.match(features, /@container control-main/);
});

test('page headers carry no context trigger and former context content renders in a Details disclosure', () => {
  const markup = controlPageHeaderMarkup({ title: 'Reputation' });
  assert.doesNotMatch(markup, /data-control-context-open|controlContextDrawer|Open page context/);
  const app = readFileSync(new URL('../docs-site/control-app.js', import.meta.url), 'utf8');
  assert.match(app, /data-details-toggle aria-expanded="\$\{open\}"/);
  assert.match(app, /renderRegisteredControlContext\(navState\.current\.path/);
  assert.match(app, /querySelector\('\[data-details-body\]'\)/);
  assert.match(app, />Details\$\{controlIcon\('chevron'/);
});
