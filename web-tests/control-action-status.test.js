import assert from 'node:assert/strict';
import test from 'node:test';

import { visibleActionStatus } from '../api/_lib/action-status.js';
import { overlayCompletedFeatureActions } from '../api/_lib/guild-state-overlay.js';

test('completed non-feature mutation remains in progress until its snapshot catches up', () => {
  assert.equal(
    visibleActionStatus({
      status: 'completed',
      actionType: 'set_log_exclusions',
      finishedAt: '2026-08-27T16:51:50.138Z',
      snapshotUpdatedAt: '2026-08-27T16:51:49.000Z',
    }),
    'claimed',
  );

  assert.equal(
    visibleActionStatus({
      status: 'completed',
      actionType: 'set_log_exclusions',
      finishedAt: '2026-08-27T16:51:50.138Z',
      snapshotUpdatedAt: '2026-08-27T16:51:57.000Z',
    }),
    'completed',
  );
});

test('feature toggle completion can be acknowledged before the full snapshot catches up', () => {
  assert.equal(
    visibleActionStatus({
      status: 'completed',
      actionType: 'set_feature',
      finishedAt: '2026-08-27T16:51:50.138Z',
      snapshotUpdatedAt: '2026-08-27T16:51:49.000Z',
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

test('completed feature actions overlay a stale feature snapshot in order', () => {
  const snapshot = {
    features: [
      { name: 'analytics', enabled: false, config: { sample: true } },
      { name: 'quizzes', enabled: true, config: {} },
    ],
  };
  const overlaid = overlayCompletedFeatureActions(snapshot, [
    { action_type: 'set_feature', result_json: { feature: 'analytics', enabled: true } },
    { action_type: 'set_feature', result_json: { feature: 'quizzes', enabled: false } },
  ]);

  assert.deepEqual(overlaid.features, [
    { name: 'analytics', enabled: true, config: { sample: true } },
    { name: 'quizzes', enabled: false, config: {} },
  ]);
  assert.equal(snapshot.features[0].enabled, false);
});

test('snapshot overlay fails closed when a newer mutation is not a feature toggle', () => {
  const snapshot = { features: [{ name: 'analytics', enabled: false, config: {} }] };
  assert.equal(
    overlayCompletedFeatureActions(snapshot, [
      { action_type: 'set_log_exclusions', result_json: { channel_ids: [] } },
    ]),
    null,
  );
});
