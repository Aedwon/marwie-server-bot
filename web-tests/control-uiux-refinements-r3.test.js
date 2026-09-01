import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { analyticsPageMarkup } from '../docs-site/control-analytics.js';
import { createCommunityPageDefinition } from '../docs-site/control-community.js';
import { featureHeaderActionsMarkup } from '../docs-site/control-components.js';

function pageState(persisted, mode = 'read', draft = structuredClone(persisted)) {
  return { mode, status: 'clean', persisted, draft, dirty: mode === 'edit', errors: {}, saveError: null };
}

function analyticsSnapshot() {
  const series = [
    { period_start: '2026-08-25T00:00:00+00:00', period_end: '2026-08-26T00:00:00+00:00', moderation_cases: 1, tickets_opened: 2, tickets_closed: 0, quiz_answers: 3, quiz_accuracy: 0.67, anonymous_questions: 0, reputation_events: 1 },
    { period_start: '2026-08-26T00:00:00+00:00', period_end: '2026-08-27T00:00:00+00:00', moderation_cases: 0, tickets_opened: 1, tickets_closed: 1, quiz_answers: 0, quiz_accuracy: null, anonymous_questions: 2, reputation_events: 0 },
    { period_start: '2026-08-27T00:00:00+00:00', period_end: '2026-08-28T00:00:00+00:00', moderation_cases: 2, tickets_opened: 0, tickets_closed: 1, quiz_answers: 4, quiz_accuracy: 0.5, anonymous_questions: 0, reputation_events: 3 },
  ];
  const projection = { period_start: series[0].period_start, period_end: series.at(-1).period_end, moderation_cases: 3, tickets_opened: 3, tickets_closed: 2, quiz_answers: 7, quiz_accuracy: 4 / 7, anonymous_questions: 2, reputation_events: 4, series };
  return {
    features: [{ name: 'analytics', enabled: true, config: {} }],
    resources: [],
    analytics: { default_range: '7d', ranges: Object.fromEntries(['1d', '3d', '7d', '2w', '1m', 'all'].map(key => [key, structuredClone(projection)])) },
  };
}

test('shared feature header hides toggles in read mode and exposes them only in edit mode', () => {
  const read = featureHeaderActionsMarkup({ label: 'Analytics', enabled: true, editing: false, editAttribute: 'data-edit', toggleAttribute: 'data-toggle' });
  assert.match(read, /Edit settings/);
  assert.doesNotMatch(read, /type="checkbox"|control-feature-toggle/);

  const edit = featureHeaderActionsMarkup({ label: 'Analytics', enabled: true, editing: true, editAttribute: 'data-edit', toggleAttribute: 'data-toggle' });
  assert.doesNotMatch(edit, /Edit settings/);
  assert.match(edit, /type="checkbox"/);
  assert.match(edit, /data-toggle/);
  assert.doesNotMatch(edit, / disabled/);
});

test('Analytics range row renders a real-series line graph without bars or a visible data table', () => {
  const snapshot = analyticsSnapshot();
  const markup = analyticsPageMarkup({ state: pageState({ enabled: true }), snapshot, selectedRange: '7d' });

  for (const key of ['1d', '3d', '7d', '2w', '1m', 'all']) assert.match(markup, new RegExp(`data-analytics-range="${key}"`));
  assert.match(markup, /class="analytics-range-row"/);
  assert.match(markup, /<svg[^>]*class="analytics-line-chart"/);
  assert.match(markup, /class="analytics-axis analytics-axis-x"/);
  assert.match(markup, /class="analytics-axis analytics-axis-y"/);
  assert.equal((markup.match(/class="analytics-line-point"/g) || []).length, 3);
  assert.doesNotMatch(markup, /analytics-chart-bars|analytics-chart-bar|View chart data|analytics-series-table|<details/);
  assert.doesNotMatch(markup, /Recorded operational events in each UTC bucket/);
});

test('Reputation removes decorative rank markers and uses Control-styled threshold fields', () => {
  const definition = createCommunityPageDefinition('/control/community/reputation');
  const persisted = { enabled: true, thresholds: { builder: 10, contributor: 25, mentor: 50 } };
  const read = definition.render({ state: pageState(persisted), snapshot: { features: [], resources: [] } });
  assert.doesNotMatch(read, /community-tier-index|>01<|>02<|>03</);

  const edit = definition.render({ state: pageState(persisted, 'edit'), snapshot: { features: [], resources: [] } });
  assert.equal((edit.match(/community-threshold-input/g) || []).length, 3);
});

test('quiz question toggle remains question-level rotation inclusion', () => {
  const definition = createCommunityPageDefinition('/control/community/quizzes');
  const persisted = {
    enabled: true,
    intervalHours: 24,
    lastPostedAt: null,
    questions: [{ id: 7, category: 'General', prompt: 'Question?', options: ['A', 'B', 'C', 'D'], correct: 1, explanation: 'Because.', enabled: true }],
  };
  const draft = structuredClone(persisted);
  draft.questions[0].enabled = false;
  assert.deepEqual(definition.diffDraft(persisted, draft), [{ action_type: 'set_quiz_question_enabled', payload: { question_id: 7, enabled: false } }]);

  const markup = definition.render({ state: pageState(persisted, 'edit', draft), snapshot: { features: [], resources: [] } });
  assert.match(markup, /Include in rotation/);
  assert.match(markup, /data-question-field="enabled"/);
  assert.doesNotMatch(markup, />\s*Enabled\s*<\/label>/);
});

test('Mappings removes generic type helper copy while retaining validation surfaces', () => {
  const source = readFileSync(new URL('../docs-site/control-mappings.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /Choose an available \$\{escapeHtml\(kindLabel\(definition\.kind\)\)\}/);
  assert.doesNotMatch(source, /Choose an available text channel|Choose an available role|Choose an available category|Choose an available forum channel|Choose an available voice channel/i);
  assert.match(source, /mapping-error|mapping-status|expectedKind|compatibleOptions/);
});

test('R3 records preserved ownership and real-data-only constraints before implementation', () => {
  const r3Spec = readFileSync(new URL('../docs/superpowers/specs/2026-09-01-control-uiux-refinements-r3.md', import.meta.url), 'utf8');
  assert.match(r3Spec, /Preserve feature ownership and page-save ownership/);
  assert.match(r3Spec, /real-data-only rule/);
});
