import assert from 'node:assert/strict';
import test from 'node:test';

import { enqueuePageSave, waitForAction } from '../docs-site/control-api.js';

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
  };
}

test('page-save client submits one logical save envelope with one idempotency key', async () => {
  const calls = [];
  const result = await enqueuePageSave({
    guildId: '1234567890123456789',
    csrfToken: 'csrf',
    idempotencyKey: 'page-save:test:12345678',
    request: {
      page_key: '/control/community/reputation',
      base_revision: 'a'.repeat(64),
      changes: [{ action_type: 'set_feature', payload: { feature: 'reputation', enabled: true } }],
    },
    fetchImpl: async (url, options) => {
      calls.push([url, options]);
      return response(202, { action: { id: '0123456789abcdef0123456789abcdef' } });
    },
    delay: async () => {},
  });
  assert.equal(result.action.id, '0123456789abcdef0123456789abcdef');
  assert.equal(calls.length, 1);
  const body = JSON.parse(calls[0][1].body);
  assert.equal(body.idempotency_key, 'page-save:test:12345678');
  assert.equal(body.payload.changes.length, 1);
  assert.equal(calls[0][1].headers['X-Rob-CSRF'], 'csrf');
});

test('action polling returns terminal action results', async () => {
  const statuses = ['queued', 'claimed', 'completed'];
  const action = await waitForAction('0123456789abcdef0123456789abcdef', {
    fetchImpl: async () => response(200, { action: { status: statuses.shift(), result: { outcome: 'saved' } } }),
    delay: async () => {},
    maxAttempts: 3,
  });
  assert.equal(action.status, 'completed');
  assert.equal(action.result.outcome, 'saved');
});

test('wake failure retries the same logical save with the same idempotency key', async () => {
  const bodies = [];
  let attempt = 0;
  const result = await enqueuePageSave({
    guildId: '1234567890123456789',
    csrfToken: 'csrf',
    idempotencyKey: 'page-save:test:87654321',
    request: {
      page_key: '/control/community/reputation',
      base_revision: 'a'.repeat(64),
      changes: [{ action_type: 'set_feature', payload: { feature: 'reputation', enabled: false } }],
    },
    fetchImpl: async (_url, options) => {
      bodies.push(JSON.parse(options.body));
      attempt += 1;
      if (attempt === 1) return response(503, { error: 'wake failed' });
      return response(200, { action: { id: 'fedcba9876543210fedcba9876543210' }, duplicate: true });
    },
    delay: async () => {},
  });
  assert.equal(result.duplicate, true);
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0].idempotency_key, bodies[1].idempotency_key);
  assert.deepEqual(bodies[0].payload, bodies[1].payload);
});
