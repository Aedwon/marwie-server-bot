import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PAGE_SAVE_ACTIONS_BY_PAGE,
  pageSavePayloadMatches,
  validatePageSavePayload,
} from '../api/_lib/page-save.js';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function normalizeActionType(value) {
  const supported = new Set([
    'set_feature', 'set_reputation_thresholds', 'set_quiz_schedule', 'add_quiz_question',
    'upsert_ai_source', 'disable_ai_source', 'upsert_ticket_type', 'disable_ticket_type',
    'save_notification_panel', 'set_resource', 'clear_resource', 'adjust_reputation',
    'refresh_ticket_panel', 'poll_ai_sources', 'send_announcement', 'post_live',
    'refresh_snapshot', 'save_page',
  ]);
  if (!supported.has(value)) throw new HttpError(400, 'Unsupported control action.');
  return value;
}

function validateActionPayload(_actionType, payload) {
  return structuredClone(payload);
}

function validate(payload) {
  return validatePageSavePayload(payload, { normalizeActionType, validateActionPayload, HttpError });
}

test('page-save ownership excludes commands-only and immediate publishing actions', () => {
  for (const actions of Object.values(PAGE_SAVE_ACTIONS_BY_PAGE)) {
    assert.equal(actions.includes('adjust_reputation'), false);
    assert.equal(actions.includes('refresh_ticket_panel'), false);
    assert.equal(actions.includes('poll_ai_sources'), false);
    assert.equal(actions.includes('send_announcement'), false);
    assert.equal(actions.includes('post_live'), false);
  }
});

test('reputation page accepts its feature toggle and thresholds in one logical save', () => {
  const result = validate({
    page_key: '/control/community/reputation',
    base_revision: 'a'.repeat(64),
    changes: [
      { action_type: 'set_feature', payload: { feature: 'reputation', enabled: true } },
      { action_type: 'set_reputation_thresholds', payload: { builder: 50, contributor: 150, mentor: 500 } },
    ],
  });
  assert.equal(result.changes.length, 2);
});

test('page-save rejects cross-page feature ownership and legacy Build Help mappings', () => {
  assert.throws(() => validate({
    page_key: '/control/content/feeds',
    base_revision: 'a'.repeat(64),
    changes: [{ action_type: 'set_feature', payload: { feature: 'reputation', enabled: true } }],
  }), error => error instanceof HttpError && error.status === 400);

  for (const key of ['build_help_forum', 'solved_tag']) {
    assert.throws(() => validate({
      page_key: '/control/mappings/channels',
      base_revision: 'a'.repeat(64),
      changes: [{ action_type: 'set_resource', payload: { key, discord_id: '123' } }],
    }), error => error instanceof HttpError && error.status === 400);
  }
});

test('page-save enforces revision, count and payload size bounds', () => {
  assert.throws(() => validate({
    page_key: '/control/community/reputation',
    base_revision: 'bad',
    changes: [{ action_type: 'set_feature', payload: { feature: 'reputation', enabled: true } }],
  }));
  assert.throws(() => validate({
    page_key: '/control/community/reputation',
    base_revision: 'a'.repeat(64),
    changes: [],
  }));
  assert.throws(() => validate({
    page_key: '/control/community/reputation',
    base_revision: 'a'.repeat(64),
    changes: [{ action_type: 'set_feature', payload: { feature: 'reputation', enabled: true, x: 'z'.repeat(70000) } }],
  }));
});

test('page-save idempotency compares normalized semantic payloads', () => {
  const left = {
    page_key: '/control/community/reputation',
    base_revision: 'a'.repeat(64),
    changes: [{ action_type: 'set_feature', payload: { feature: 'reputation', enabled: true } }],
  };
  const reordered = {
    changes: [{ payload: { enabled: true, feature: 'reputation' }, action_type: 'set_feature' }],
    base_revision: 'a'.repeat(64),
    page_key: '/control/community/reputation',
  };
  const changed = structuredClone(left);
  changed.changes[0].payload.enabled = false;
  assert.equal(pageSavePayloadMatches(left, reordered), true);
  assert.equal(pageSavePayloadMatches(left, changed), false);
});
