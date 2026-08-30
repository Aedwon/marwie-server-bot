import assert from 'node:assert/strict';
import test from 'node:test';
import { createNavigationState, navigationModel } from '../docs-site/control-navigation.js';
import { destinationForPath } from '../docs-site/control-router.js';

test('one expandable primary domain remains revealed independently from the current route', () => {
  const state = createNavigationState({ currentPath: '/control/community/quizzes' });
  assert.equal(state.expandedDomain, 'community');

  state.revealDomain('content');
  assert.equal(state.expandedDomain, 'content');
  assert.equal(state.current.path, '/control/community/quizzes');

  state.select('/control/community/reputation');
  assert.equal(state.expandedDomain, 'content');
  assert.equal(state.current.path, '/control/community/reputation');
});

test('analytics joins Commands and Activity in the visually secondary direct group', () => {
  const current = destinationForPath('/control/analytics');
  const model = navigationModel(current, 'community');
  assert.equal(model.primary.some(item => item.key === 'analytics'), false);
  assert.deepEqual(
    model.secondary.map(item => item.path),
    ['/control/analytics', '/control/commands', '/control/activity'],
  );
  assert.equal(model.primary.filter(item => item.expanded).length, 1);
});
