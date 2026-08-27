import assert from 'node:assert/strict';
import test from 'node:test';

import { visibleActionStatus } from '../api/_lib/action-status.js';

test('completed mutation remains in progress until its snapshot catches up', () => {
  assert.equal(
    visibleActionStatus({
      status: 'completed',
      actionType: 'set_feature',
      finishedAt: '2026-08-27T16:51:50.138Z',
      snapshotUpdatedAt: '2026-08-27T16:51:49.000Z',
    }),
    'claimed',
  );

  assert.equal(
    visibleActionStatus({
      status: 'completed',
      actionType: 'set_feature',
      finishedAt: '2026-08-27T16:51:50.138Z',
      snapshotUpdatedAt: '2026-08-27T16:51:57.000Z',
    }),
    'completed',
  );
});

test('snapshot refresh completion is already snapshot-consistent', () => {
  assert.equal(
    visibleActionStatus({
      status: 'completed',
      actionType: 'refresh_snapshot',
      finishedAt: '2026-08-27T16:09:41.147Z',
      snapshotUpdatedAt: '2026-08-27T16:09:38.030Z',
    }),
    'completed',
  );
});

test('non-completed actions preserve their worker status', () => {
  assert.equal(
    visibleActionStatus({
      status: 'queued',
      actionType: 'set_feature',
      finishedAt: null,
      snapshotUpdatedAt: null,
    }),
    'queued',
  );
  assert.equal(
    visibleActionStatus({
      status: 'rejected',
      actionType: 'set_feature',
      finishedAt: '2026-08-27T16:51:50.138Z',
      snapshotUpdatedAt: null,
    }),
    'rejected',
  );
});
