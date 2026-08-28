import assert from 'node:assert/strict';
import test from 'node:test';

import {
  activityProjection,
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
  assert.doesNotMatch(JSON.stringify(projected), /do not expose/);
});

test('Activity cursor round trips stable created-at/id ordering material', () => {
  const id = '0123456789abcdef0123456789abcdef';
  const createdAt = '2026-08-28T00:00:00.000Z';
  const cursor = encodeActivityCursor(createdAt, id);
  assert.deepEqual(decodeActivityCursor(cursor), { created_at: createdAt, id });
  assert.throws(() => decodeActivityCursor('not-a-valid-cursor'));
});
