import assert from 'node:assert/strict';
import test from 'node:test';
import { createNavigationState, navigationModel } from '../docs-site/control-navigation.js';
import { destinationForPath } from '../docs-site/control-router.js';

test('one feature group is revealed and selecting a route reveals its owning group', () => {
  const state = createNavigationState({ currentPath: '/control/community/quizzes' });
  assert.equal(state.expandedDomain, 'engagement');

  state.revealDomain('publishing');
  assert.equal(state.expandedDomain, 'publishing');
  assert.equal(state.current.path, '/control/community/quizzes');

  state.select('/control/community/reputation');
  assert.equal(state.expandedDomain, 'engagement');
  assert.equal(state.current.path, '/control/community/reputation');
});

test('Analytics and Activity belong to Insights while Resources is top level and Commands and Handbook are Reference', () => {
  const current = destinationForPath('/control/analytics');
  const model = navigationModel(current, 'insights');
  const groups = model.items.filter(item => item.type === 'group');
  assert.deepEqual(groups.map(item => item.key), ['engagement', 'publishing', 'support-safety', 'insights']);
  assert.deepEqual(
    groups.find(item => item.key === 'insights').children.map(item => item.path),
    ['/control/analytics', '/control/activity'],
  );
  assert.equal(model.items.some(item => item.key === 'system'), false);
  assert.deepEqual(
    model.items.filter(item => item.type === 'link').map(item => item.path),
    [
      '/control/overview',
      '/control/mappings/channels',
      '/control/workflows/ticket-handling',
      '/control/workflows/events',
      '/commands',
      '/handbook',
    ],
  );
  assert.equal(groups.filter(item => item.expanded).length, 1);
});
