import assert from 'node:assert/strict';
import test from 'node:test';
import { createNavigationState, navigationModel } from '../docs-site/control-navigation.js';
import { destinationForPath } from '../docs-site/control-router.js';

test('one expandable primary domain remains expanded and selecting a domain restores its last child', () => {
  const state = createNavigationState({ currentPath: '/control/community/quizzes' });
  assert.equal(state.expandedDomain, 'community');
  state.select('/control/content/live');
  assert.equal(state.expandedDomain, 'content');
  state.select('/control/community/reputation');
  state.selectDomain('content');
  assert.equal(state.current.path, '/control/content/live');
  assert.equal(state.expandedDomain, 'content');
});

test('analytics remains direct and secondary destinations stay visually secondary', () => {
  const current = destinationForPath('/control/analytics');
  const model = navigationModel(current, 'community');
  const analytics = model.primary.find(item => item.key === 'analytics');
  assert.equal(analytics.direct, true);
  assert.deepEqual(model.secondary.map(item => item.path), ['/control/commands', '/control/activity']);
  assert.equal(model.primary.filter(item => item.expanded).length, 1);
});
