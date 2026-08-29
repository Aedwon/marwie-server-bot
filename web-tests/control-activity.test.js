import assert from 'node:assert/strict';
import test from 'node:test';

import {
  activityProjection,
  activitySummary,
  decodeActivityCursor,
  encodeActivityCursor,
} from '../api/_lib/activity.js';

test('Activity projection is sanitized and human readable', () => {
  const projected = activityProjection({
    id: '0123456789abcdef0123456789abcdef',
    actor_id: '1234567890123456789',
    action_type: 'save_page',
    status: 'failed',
    payload_json: {
      page_key: '/control/community/reputation',
      changes: [{ payload: { secret: 'do not expose' } }],
    },
    result_json: { secret: 'do not expose result' },
    user_error: 'One setting failed.',
    error_reference: 'ABC12345',
    created_at: '2026-08-28T00:00:00Z',
    finished_at: '2026-08-28T00:00:01Z',
  });
  assert.equal(projected.summary, 'Saved Reputation settings');
  assert.equal(projected.actor.id, '1234567890123456789');
  assert.equal(projected.failure.message, 'One setting failed.');
  assert.equal(projected.failure.reference, 'ABC12345');
  assert.equal(projected.timestamp, '2026-08-28T00:00:01Z');
  assert.equal(Object.hasOwn(projected, 'payload_json'), false);
  assert.equal(Object.hasOwn(projected, 'result_json'), false);
  assert.equal(Object.hasOwn(projected, 'action_type'), false);
  assert.doesNotMatch(JSON.stringify(projected), /do not expose/);
});

test('Activity summaries cover current Stage 3 user-visible actions and keep a safe fallback', () => {
  const expected = new Map([
    ['set_resource', 'Updated a Discord mapping'],
    ['clear_resource', 'Cleared a Discord mapping'],
    ['apply_auto_setup', 'Applied suggested server setup'],
    ['apply_mapping_suggestions', 'Applied reviewed mapping suggestions'],
    ['set_feature', 'Changed feature availability'],
    ['set_log_exclusions', 'Updated message log exclusions'],
    ['save_notification_panel', 'Updated notification roles'],
    ['upsert_ticket_type', 'Updated a ticket type'],
    ['disable_ticket_type', 'Disabled a ticket type'],
    ['refresh_ticket_panel', 'Refreshed the ticket panel'],
    ['set_reputation_thresholds', 'Updated reputation thresholds'],
    ['adjust_reputation', 'Adjusted member reputation'],
    ['set_quiz_schedule', 'Updated quiz scheduling'],
    ['add_quiz_question', 'Added a quiz question'],
    ['update_quiz_question', 'Updated a quiz question'],
    ['set_quiz_question_enabled', 'Changed quiz question availability'],
    ['upsert_ai_source', 'Updated an AI feed source'],
    ['disable_ai_source', 'Disabled an AI feed source'],
    ['poll_ai_sources', 'Ran manual AI feed polling'],
    ['send_announcement', 'Sent an announcement'],
    ['post_live', 'Posted a live announcement'],
  ]);

  for (const [actionType, summary] of expected) {
    assert.equal(activitySummary({ action_type: actionType }), summary, actionType);
  }
  assert.equal(activitySummary({ action_type: 'future_action' }), 'Performed a Control action');
});

test('Activity cursor round trips stable created-at/id ordering material', () => {
  const id = '0123456789abcdef0123456789abcdef';
  const createdAt = '2026-08-28T00:00:00.000Z';
  const cursor = encodeActivityCursor(createdAt, id);
  assert.deepEqual(decodeActivityCursor(cursor), { created_at: createdAt, id });
  assert.throws(() => decodeActivityCursor('not-a-valid-cursor'));
});
