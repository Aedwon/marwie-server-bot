import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { activityPageMarkup, commandsPageMarkup } from '../docs-site/control-secondary.js';
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
  '/control/community/reputation': ['Reputation', 'Enabled', 'Tier progression', '50 pts', 'Mentor'],
  '/control/community/quizzes': ['Quizzes', 'Enabled', 'Operational snapshot', 'Question bank', 'What does len return?', 'Python'],
  '/control/community/voice-coworking': ['Voice &amp; Coworking', 'Enabled', 'Temporary voice', 'Temporary Voice', 'temporary voice channel'],
  '/control/community/showcase': ['Showcase', 'Enabled', 'Showcase destinations', 'App of the Week', 'Collab LFG'],
  '/control/utilities/notification-roles': ['Notification roles', 'Preview', 'Builder updates', 'Primary', 'Secondary'],
  '/control/content/feeds': ['Feeds', 'Enabled', 'Sources', 'OpenAI', 'ai-updates'],
  '/control/content/announcements': ['Announcements', 'Enabled', 'Announcement builder', 'Post'],
  '/control/content/live': ['Live', 'Enabled', 'Live notice', '#live', 'Post Live notice'],
  '/control/utilities/ticket-configuration': ['Tickets', 'Enabled', 'Ticket intake', 'Ticket types', 'Support', 'Report'],
  '/control/utilities/anonymous-questions': ['Anonymous Questions', 'Enabled', 'Intake behavior', 'Anonymous Questions'],
  '/control/workflows/moderation': ['Moderation', 'Enabled', 'Configuration', 'Operating guide', 'Prepare'],
  '/control/analytics': ['Analytics', 'Enabled', 'Moderation cases', 'Activity over time'],
};

const EDIT_EXPECTATIONS = {
  '/control/community/reputation': ['Tier thresholds', 'Save changes', 'Discard'],
  '/control/community/quizzes': ['Question bank', 'Add question', 'Save changes'],
  '/control/community/voice-coworking': ['Save changes', 'Discard'],
  '/control/community/showcase': ['Save changes', 'Discard'],
  '/control/utilities/notification-roles': ['Buttons', 'Add button', 'Preview', 'Save changes'],
  '/control/content/feeds': ['Sources', 'Add source', 'Save changes'],
  '/control/content/announcements': ['Announcement builder', 'Post'],
  '/control/content/live': ['Live notice', 'Post Live notice'],
  '/control/utilities/ticket-configuration': ['Ticket types', 'Add ticket type', 'Save changes'],
  '/control/utilities/anonymous-questions': ['Save changes', 'Discard'],
  '/control/workflows/moderation': ['Operating guide', 'Save changes'],
  '/control/analytics': ['Moderation cases', 'Save changes'],
};

const CONTEXT_EXPECTATIONS = {
  '/control/community/reputation': ['Builder', 'Mentor'],
  '/control/community/quizzes': ['Quiz channel'],
  '/control/community/voice-coworking': ['Temporary voice category'],
  '/control/community/showcase': ['Showcase forum'],
  '/control/utilities/notification-roles': ['Role panel'],
  '/control/content/feeds': ['Channel'],
  '/control/content/announcements': ['Destination', 'Preview', 'Send readiness'],
  '/control/content/live': ['Live announcements', 'Live ping role'],
  '/control/utilities/ticket-configuration': ['Ticket panel', 'Ticket logs', 'Ticket category'],
  '/control/utilities/anonymous-questions': ['Anonymous questions'],
  '/control/workflows/moderation': ['Moderation log', 'Compromised account trap'],
  '/control/analytics': ['Report destination'],
};

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
    if (pageKey !== '/control/content/announcements' && pageKey !== '/control/content/live') {
      assert.match(markup, /Save changes/, `${pageKey} must expose Save changes`);
    }
    controlState.discard(pageKey);
    controlState.get(pageKey).mode = 'read';
  }
});

test('notification roles has no inert feature toggle', () => {
  const read = renderRegisteredControlPage('/control/utilities/notification-roles', { snapshot });
  assert.match(read, /Edit settings/, 'notification roles read mode must still expose Edit settings');
  assert.doesNotMatch(read, /control-feature-toggle/, 'notification roles read mode must not render a feature toggle');
  controlState.beginEdit('/control/utilities/notification-roles');
  const edit = renderRegisteredControlPage('/control/utilities/notification-roles', { snapshot });
  assert.doesNotMatch(edit, /control-feature-toggle/, 'notification roles edit mode must not render an inert feature toggle');
  controlState.discard('/control/utilities/notification-roles');
  controlState.get('/control/utilities/notification-roles').mode = 'read';
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
  const tickets = renderRegisteredControlPage('/control/utilities/ticket-configuration', { snapshot });
  assert.match(tickets, /data-label="Key"/);
  assert.match(tickets, /data-label="Description"/);
  const feeds = renderRegisteredControlPage('/control/content/feeds', { snapshot });
  assert.match(feeds, /data-label="URL"/);
  assert.match(feeds, /data-label="Last checked"/);
  const mappings = renderRegisteredControlPage('/control/mappings/channels', { snapshot });
  assert.match(mappings, /data-label="Current"/);
  assert.match(mappings, /data-label="Status"/);
});

test('edit mode context delegates resource status to the generic editor', () => {
  const cases = [
    ['/control/community/reputation', /All 3 Discord resources are connected\./],
    ['/control/content/announcements', /<dt>Destination<\/dt>/],
    ['/control/content/feeds', /<dt>Channel<\/dt>/],
    ['/control/analytics', /<dt>Channel<\/dt>/],
    ['/control/workflows/moderation', /<dt>Moderation log<\/dt>/],
  ];
  for (const [pageKey, duplicate] of cases) {
    controlState.beginEdit(pageKey);
    const markup = renderRegisteredControlContext(pageKey, { snapshot });
    assert.match(markup, /Discord resources/, `${pageKey} edit context must expose the generic resource editor`);
    assert.doesNotMatch(markup, duplicate, `${pageKey} edit context must not repeat the resource status row`);
    controlState.discard(pageKey);
    controlState.get(pageKey).mode = 'read';
  }
});

test('system routes render without a contextual column', () => {
  for (const pageKey of NO_CONTEXT_ROUTES) {
    assert.equal(renderRegisteredControlContext(pageKey, { snapshot }), '', `${pageKey} must have no context`);
    const markup = renderRegisteredControlPage(pageKey, { snapshot });
    assert.match(markup, /<h1[^>]*>Resources<\/h1>/, `${pageKey} must render the Resources header`);
  }
  assert.equal(renderRegisteredControlContext('/control/commands', { snapshot }), '');
  assert.equal(renderRegisteredControlContext('/control/activity', { snapshot }), '');

  const commands = commandsPageMarkup();
  assertContains(commands, ['Commands', 'Adjust member reputation', 'Open the full Commands manual'], 'Commands');
  const activity = activityPageMarkup({
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
  assertContains(activity, ['Activity', 'Changed Reputation thresholds', 'Completed'], 'Activity');
});

test('guidance playbooks keep the shared header and step anatomy', () => {
  for (const [pageKey, title] of [
    ['/control/workflows/ticket-handling', 'Ticket handling'],
    ['/control/workflows/events', 'Events'],
  ]) {
    const markup = workflowPageMarkup(pageKey);
    assertContains(markup, [title, 'Prepare', 'Operating guide', 'control-page-header'], `${pageKey} playbook`);
    assert.doesNotMatch(markup, /Save changes|Edit settings/);
  }
});

test('read mode never prints raw notification style enums', () => {
  const markup = renderRegisteredControlPage('/control/utilities/notification-roles', { snapshot });
  assert.match(markup, /<dd>Primary<\/dd>/);
  assert.match(markup, /<dd>Secondary<\/dd>/);
  assert.doesNotMatch(markup, /<dd>primary<\/dd>/);
  assert.doesNotMatch(markup, /<dd>secondary<\/dd>/);
});

test('Analytics no longer duplicates the report resource table in the center', () => {
  const markup = renderRegisteredControlPage('/control/analytics', { snapshot });
  assert.doesNotMatch(markup, /analytics-reporting-table/);
  assert.doesNotMatch(markup, /Report channel/);
  const context = renderRegisteredControlContext('/control/analytics', { snapshot });
  assert.match(context, /Report destination/);
});

test('the shell declares context presence so the right column can collapse', () => {
  const html = readFileSync(new URL('../docs-site/control.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../docs-site/control.css', import.meta.url), 'utf8');
  const features = readFileSync(new URL('../docs-site/control-features.css', import.meta.url), 'utf8');

  assert.doesNotMatch(html, /styles\.css/);
  assert.doesNotMatch(html, /control-emoji-picker\.css/);
  assert.match(html, /class="control-shell"[^>]*data-context="false"/);
  assert.match(css, /\.control-shell\[data-context="true"\]/);
  assert.match(css, /\.control-shell\[data-context="false"\]/);
  assert.match(css, /\.sr-only/);
  assert.match(features, /font-size: 28px/);
  assert.match(features, /font-size: 18px/);
  assert.match(css, /grid-template-columns: var\(--control-left-width\) minmax\(0, 1fr\)/);
});
