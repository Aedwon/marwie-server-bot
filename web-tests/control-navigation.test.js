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

test('Analytics and Activity belong to Insights while Commands and Resources belong to System', () => {
  const current = destinationForPath('/control/analytics');
  const model = navigationModel(current, 'insights');
  assert.deepEqual(
    model.primary.map(item => item.key),
    ['engagement', 'publishing', 'support-safety', 'insights', 'system'],
  );
  assert.deepEqual(
    model.primary.find(item => item.key === 'insights').children.map(item => item.path),
    ['/control/analytics', '/control/activity'],
  );
  assert.deepEqual(
    model.primary.find(item => item.key === 'system').children.map(item => item.label),
    ['Resources', 'Commands'],
  );
  assert.deepEqual(model.secondary.map(item => item.path), [
    '/control/workflows/ticket-handling',
    '/control/workflows/events',
  ]);
  assert.equal(model.primary.filter(item => item.expanded).length, 1);
});
