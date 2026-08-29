import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  analyticsPageMarkup,
  createAnalyticsPageDefinition,
} from '../docs-site/control-analytics.js';
import { legacyMountPlanForPath } from '../docs-site/control-page-adapter.js';
import { destinationForPath } from '../docs-site/control-router.js';
import {
  WORKFLOW_PAGE_CONFIGS,
  workflowPageMarkup,
} from '../docs-site/control-workflows.js';

const analyticsSnapshot = {
  features: [{ name: 'analytics', enabled: true, config: {} }],
  resources: [{
    key: 'analytics',
    id: '123',
    name: 'weekly-analytics',
    exists: true,
    kind: 'text',
  }],
  analytics: {
    period_start: '2026-08-21T12:00:00+00:00',
    period_end: '2026-08-28T12:00:00+00:00',
    moderation_cases: 4,
    tickets_opened: 5,
    tickets_closed: 3,
    quiz_answers: 20,
    quiz_accuracy: 0.75,
    anonymous_questions: 2,
    reputation_events: 9,
  },
};

function readState(definition) {
  const persisted = definition.selectPersisted(analyticsSnapshot);
  return {
    mode: 'read',
    status: 'clean',
    persisted,
    draft: definition.cloneDraft(persisted),
    revision: 'a'.repeat(64),
    dirty: false,
    errors: {},
    saveError: null,
  };
}

function commandSection(command) {
  const manual = readFileSync(new URL('../docs/commands.md', import.meta.url), 'utf8');
  const marker = `## \`${command}\``;
  const start = manual.indexOf(marker);
  assert.notEqual(start, -1, `${command} must exist in docs/commands.md`);
  const remaining = manual.slice(start);
  const end = remaining.indexOf('\n---\n');
  return end === -1 ? remaining : remaining.slice(0, end);
}

function assertPlainWorkflowMarkup(markup) {
  assert.equal((markup.match(/<h1\b/g) || []).length, 1);
  assert.doesNotMatch(markup, /control-eyebrow/);
  assert.doesNotMatch(markup, />\s*(?:Operations|Handbook|Workflow|Control|Configuration)\s*</i);
  assert.doesNotMatch(markup, /Bot status|System status|Global health|Connectivity status/i);
  assert.doesNotMatch(markup, /Edit settings|Save changes|Discard/);
  assert.doesNotMatch(markup, /type="checkbox"|role="switch"|<select|<form/i);
  assert.doesNotMatch(markup, /schedule|scheduler|run workflow|execute workflow/i);
  assert.doesNotMatch(markup, /Activity history|control-action history/i);
  assert.doesNotMatch(markup, /data-mapping-key|mapping-editor/i);
}

test('Analytics is a direct canonical route, not a legacy-mounted feature section', () => {
  const destination = destinationForPath('/control/analytics');
  assert.equal(destination?.kind, 'primary-direct');
  assert.equal(destination?.path, '/control/analytics');
  assert.equal(legacyMountPlanForPath('/control/analytics'), null);
});

test('Analytics page exposes exactly the V1 operational metrics and period', () => {
  const definition = createAnalyticsPageDefinition();
  const markup = analyticsPageMarkup({
    state: readState(definition),
    snapshot: analyticsSnapshot,
  });

  assert.match(markup, /<h1[^>]*>Analytics<\/h1>/);
  assert.equal((markup.match(/<h1\b/g) || []).length, 1);
  assert.doesNotMatch(markup, /control-eyebrow/);
  assert.doesNotMatch(markup, />\s*(?:Operations|Handbook|Workflow|Control|Configuration)\s*</i);
  assert.doesNotMatch(markup, /Bot status|System status|Global health|Connectivity status/i);
  assert.match(markup, /Previous 7 days/i);
  assert.match(markup, /Moderation cases/);
  assert.match(markup, /Tickets opened/);
  assert.match(markup, /Tickets closed/);
  assert.match(markup, /Quiz answers/);
  assert.match(markup, /Quiz accuracy/);
  assert.match(markup, /75%/);
  assert.match(markup, /Anonymous questions/);
  assert.match(markup, /Reputation events/);
  assert.doesNotMatch(markup, /Build Help|Solved build-help/i);
  assert.doesNotMatch(markup, /active member|member growth|heatmap|channel activity/i);
  assert.doesNotMatch(markup, /<canvas|<svg[^>]*chart/i);
});

test('Analytics metric values use semantic definition-list associations without metric cards', () => {
  const definition = createAnalyticsPageDefinition();
  const markup = analyticsPageMarkup({ state: readState(definition), snapshot: analyticsSnapshot });

  assert.match(markup, /<dl[^>]*class="analytics-metrics"/);
  assert.equal((markup.match(/<dt\b/g) || []).length, 7);
  assert.equal((markup.match(/<dd\b/g) || []).length, 7);
  assert.doesNotMatch(markup, /class="analytics-metric"/);

  const styles = readFileSync(new URL('../docs-site/control-analytics-workflows.css', import.meta.url), 'utf8');
  assert.doesNotMatch(styles, /\.analytics-metric(?!s)\b/);
});

test('Analytics owns only its feature flag and links report-channel ownership to Mappings', () => {
  const definition = createAnalyticsPageDefinition();
  const persisted = definition.selectPersisted(analyticsSnapshot);
  const draft = definition.cloneDraft(persisted);
  draft.enabled = false;

  assert.deepEqual(definition.diffDraft(persisted, draft), [{
    action_type: 'set_feature',
    payload: { feature: 'analytics', enabled: false },
  }]);

  const readMarkup = analyticsPageMarkup({
    state: readState(definition),
    snapshot: analyticsSnapshot,
  });
  assert.match(readMarkup, /Edit settings/);
  assert.match(readMarkup, /weekly-analytics/);
  assert.match(readMarkup, /href="\/control\/mappings\/channels"/);
  assert.doesNotMatch(readMarkup, /<select/);
  assert.doesNotMatch(readMarkup, /data-submenu|control-subnav/);

  const editMarkup = analyticsPageMarkup({
    state: {
      ...readState(definition),
      mode: 'edit',
      draft: { enabled: false },
      dirty: true,
    },
    snapshot: analyticsSnapshot,
  });
  assert.match(editMarkup, /Save changes/);
  assert.match(editMarkup, /Discard/);
  assert.match(editMarkup, /type="checkbox"/);
  assert.doesNotMatch(editMarkup, /analytics.*<select/is);
});

test('Analytics complete report with true zero values renders measured zeroes', () => {
  const definition = createAnalyticsPageDefinition();
  const snapshot = structuredClone(analyticsSnapshot);
  snapshot.analytics = {
    period_start: '2026-08-21T12:00:00+00:00',
    period_end: '2026-08-28T12:00:00+00:00',
    moderation_cases: 0,
    tickets_opened: 0,
    tickets_closed: 0,
    quiz_answers: 0,
    quiz_accuracy: 0,
    anonymous_questions: 0,
    reputation_events: 0,
  };

  const markup = analyticsPageMarkup({ state: readState(definition), snapshot });
  assert.equal((markup.match(/<dd\b[^>]*>\s*0\s*<\/dd>/g) || []).length, 6);
  assert.match(markup, /<dt[^>]*>Quiz accuracy<\/dt>\s*<dd[^>]*>0%<\/dd>/);
  assert.doesNotMatch(markup, /Analytics data unavailable/i);
});

test('Analytics missing projection shows one unavailable state instead of seven fake zeroes', () => {
  const definition = createAnalyticsPageDefinition();
  const snapshot = structuredClone(analyticsSnapshot);
  delete snapshot.analytics;

  const markup = analyticsPageMarkup({ state: readState(definition), snapshot });
  assert.match(markup, /role="status"/);
  assert.match(markup, /Analytics data unavailable/i);
  assert.doesNotMatch(markup, /<dl[^>]*class="analytics-metrics"/);
  assert.doesNotMatch(markup, /Moderation cases|Tickets opened|Tickets closed|Quiz answers|Quiz accuracy|Anonymous questions|Reputation events/);
  assert.match(markup, /Reporting/);
  assert.match(markup, /weekly-analytics/);
});

test('Analytics zero-answer accuracy is rendered as unavailable, not zero percent', () => {
  const definition = createAnalyticsPageDefinition();
  const snapshot = structuredClone(analyticsSnapshot);
  snapshot.analytics.quiz_answers = 0;
  snapshot.analytics.quiz_accuracy = null;
  const markup = analyticsPageMarkup({ state: readState(definition), snapshot });
  assert.match(markup, /Quiz accuracy/);
  assert.match(markup, /No answers in this period/i);
  assert.doesNotMatch(markup, /0%/);
});

test('all three Workflow pages are handbook-only semantic pages without redundant page meta', () => {
  const expected = new Map([
    ['/control/workflows/moderation', 'Moderation'],
    ['/control/workflows/ticket-handling', 'Ticket handling'],
    ['/control/workflows/events', 'Events'],
  ]);

  assert.deepEqual(Object.keys(WORKFLOW_PAGE_CONFIGS).sort(), [...expected.keys()].sort());

  for (const [pageKey, title] of expected) {
    const route = destinationForPath(pageKey);
    assert.equal(route?.path, pageKey);
    const markup = workflowPageMarkup(pageKey);
    assert.match(markup, new RegExp(`<h1[^>]*>${title}<\\/h1>`));
    assertPlainWorkflowMarkup(markup);
  }
});

test('Workflow sections are plain document sections instead of decorative card tiles', () => {
  const styles = readFileSync(new URL('../docs-site/control-analytics-workflows.css', import.meta.url), 'utf8');
  assert.doesNotMatch(
    styles,
    /[^{}]*\.workflow-section[^{}]*\{[^{}]*(?:border(?:-radius)?\s*:|background\s*:)/s,
  );

  for (const pageKey of Object.keys(WORKFLOW_PAGE_CONFIGS)) {
    const markup = workflowPageMarkup(pageKey);
    assert.match(markup, /<section class="workflow-section">/);
    assert.match(markup, /<h2>/);
  }
});

test('Workflow guidance stays factual instead of inventing moderation policy', () => {
  const moderation = workflowPageMarkup('/control/workflows/moderation');
  assert.doesNotMatch(moderation, /least severe appropriate response/i);
  assert.match(moderation, /moderation command/i);
});

test('Workflow guidance links to existing owners without becoming configuration UI', () => {
  const moderation = workflowPageMarkup('/control/workflows/moderation');
  assert.match(moderation, /\/control\/commands/);
  assert.match(moderation, /\/control\/mappings\/channels/);

  const tickets = workflowPageMarkup('/control/workflows/ticket-handling');
  assert.match(tickets, /\/control\/utilities\/ticket-configuration/);
  assert.match(tickets, /\/control\/mappings\/channels/);

  const events = workflowPageMarkup('/control/workflows/events');
  assert.match(events, /\/control\/content\/announcements/);
  assert.match(events, /\/control\/content\/live/);
});

test('/analytics command documentation matches the V1 runtime contract', () => {
  const section = commandSection('/analytics');

  assert.match(section, /\*\*Syntax:\*\* `\/analytics`/);
  assert.match(section, /\*\*Permission:\*\* Manage Server/);
  assert.match(section, /168-hour/i);
  assert.match(section, /moderation cases/i);
  assert.match(section, /tickets opened/i);
  assert.match(section, /tickets closed/i);
  assert.match(section, /quiz answers/i);
  assert.match(section, /quiz accuracy/i);
  assert.match(section, /No answers in this period/i);
  assert.match(section, /anonymous questions/i);
  assert.match(section, /reputation events/i);
  assert.match(section, /member-level or raw activity data/i);
  assert.match(section, /private|ephemeral/i);
  assert.match(section, /weekly/i);
  assert.match(section, /Build Help is not an Analytics V1 metric/i);
  assert.match(section, /unanswered Build Help.*separate automation/is);
  assert.doesNotMatch(section, /quiz correct-answer count/i);
  assert.doesNotMatch(section, /solved Build Help threads/i);
});
