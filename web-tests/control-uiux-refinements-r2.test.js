import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyticsPageMarkup,
  createAnalyticsPageDefinition,
  installAnalyticsPageInteractions,
} from '../docs-site/control-analytics.js';
import { createCommunityPageDefinition } from '../docs-site/control-community.js';
import { createControlStateStore } from '../docs-site/control-state.js';

const VOICE_COWORKING = '/control/community/voice-coworking';

function feature(name, enabled) {
  return { name, enabled, config: {} };
}

function readState(definition, snapshot) {
  const persisted = definition.selectPersisted(snapshot);
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

test('Voice & Coworking exposes one Temporary voice owner and never writes coworking', () => {
  const definition = createCommunityPageDefinition(VOICE_COWORKING);
  const snapshot = {
    features: [feature('voice', true), feature('coworking', false)],
    resources: [
      { key: 'create_workspace_voice', id: '1', name: 'Create Workspace', exists: true },
      { key: 'temp_voice_category', id: '2', name: 'Temporary voice', exists: true },
      { key: 'coworking_lounge', id: '3', name: 'Lounge', exists: true },
    ],
  };
  const persisted = definition.selectPersisted(snapshot);
  assert.deepEqual(persisted, { voiceEnabled: true });
  const draft = definition.cloneDraft(persisted);
  draft.voiceEnabled = false;
  draft.coworkingEnabled = true;
  assert.deepEqual(definition.diffDraft(persisted, draft), [
    { action_type: 'set_feature', payload: { feature: 'voice', enabled: false } },
  ]);

  const markup = definition.render({
    state: { ...readState(definition, snapshot), mode: 'edit', draft, dirty: true },
    snapshot,
  });
  assert.match(markup, /Temporary voice/);
  assert.equal((markup.match(/data-community-field="voiceEnabled"/g) || []).length, 1);
  assert.doesNotMatch(markup, /data-community-field="coworkingEnabled"/);
  assert.doesNotMatch(markup, /Voice channels/);
  assert.doesNotMatch(markup, /create_workspace_voice|coworking_lounge/);
  assert.match(markup, /Temporary voice category/);
});

test('Analytics dashboard defaults to 7d and renders only real supplied range series', () => {
  const definition = createAnalyticsPageDefinition();
  const range = {
    period_start: '2026-08-25T12:00:00+00:00',
    period_end: '2026-09-01T12:00:00+00:00',
    moderation_cases: 2,
    tickets_opened: 3,
    tickets_closed: 1,
    quiz_answers: 4,
    quiz_accuracy: 0.75,
    anonymous_questions: 1,
    reputation_events: 5,
    series: [
      { period_start: '2026-08-25T12:00:00+00:00', period_end: '2026-08-26T12:00:00+00:00', moderation_cases: 1, tickets_opened: 1, tickets_closed: 0, quiz_answers: 1, quiz_accuracy: 1, anonymous_questions: 0, reputation_events: 1 },
      { period_start: '2026-08-26T12:00:00+00:00', period_end: '2026-09-01T12:00:00+00:00', moderation_cases: 1, tickets_opened: 2, tickets_closed: 1, quiz_answers: 3, quiz_accuracy: 2 / 3, anonymous_questions: 1, reputation_events: 4 },
    ],
  };
  const snapshot = {
    features: [feature('analytics', true)],
    resources: [{ key: 'analytics', id: '20', name: 'analytics', exists: true, kind: 'text' }],
    analytics: {
      ...range,
      default_range: '7d',
      ranges: Object.fromEntries(['1d', '3d', '7d', '2w', '1m', 'all'].map(key => [key, range])),
    },
  };

  const markup = analyticsPageMarkup({ state: readState(definition, snapshot), snapshot });
  for (const key of ['1d', '3d', '7d', '2w', '1m', 'all']) {
    assert.match(markup, new RegExp(`data-analytics-range=\"${key}\"`));
  }
  assert.match(markup, /data-selected="true"[^>]*>7d</i);
  assert.match(markup, /Activity over time/);
  assert.match(markup, /analytics-series-table/);
  assert.doesNotMatch(markup, /Previous 7 days · exact 168-hour UTC window/);
});

test('Analytics discard exits edit mode and restores the persisted draft', () => {
  const definition = createAnalyticsPageDefinition();
  const store = createControlStateStore();
  const snapshot = {
    features: [feature('analytics', true)],
    resources: [],
  };
  store.register(definition);
  store.hydrate(definition.pageKey, snapshot, 'a'.repeat(64));
  store.beginEdit(definition.pageKey);
  store.updateDraft(definition.pageKey, draft => { draft.enabled = false; });

  const listeners = new Map();
  const root = {
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
  };
  installAnalyticsPageInteractions({ root, store });

  listeners.get('click')({
    target: {
      closest(selector) {
        return selector === '[data-analytics-discard]' ? this : null;
      },
    },
  });

  const state = store.get(definition.pageKey);
  assert.equal(state.mode, 'read');
  assert.equal(state.draft.enabled, true);
});
