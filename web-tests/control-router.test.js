import assert from 'node:assert/strict';
import test from 'node:test';
import { CONTROL_DESTINATIONS, resolveControlRoute } from '../docs-site/control-router.js';

const paths = [
  '/control/community/reputation','/control/community/quizzes','/control/community/voice-coworking','/control/community/showcase',
  '/control/content/feeds','/control/content/announcements','/control/content/live',
  '/control/utilities/ticket-configuration','/control/utilities/notification-roles','/control/utilities/anonymous-questions',
  '/control/analytics','/control/workflows/moderation','/control/workflows/ticket-handling','/control/workflows/events',
  '/control/mappings/channels','/control/mappings/roles','/control/mappings/categories','/control/commands','/control/activity'
];

test('canonical destinations exactly match approved IA', () => {
  assert.deepEqual(CONTROL_DESTINATIONS.map(item => item.path), paths);
  assert.equal(CONTROL_DESTINATIONS.some(item => /overview|build-help/.test(item.path)), false);
});

test('/control restores a valid last destination and otherwise falls back to reputation', () => {
  assert.equal(resolveControlRoute('/control', '/control/content/live').path, '/control/content/live');
  assert.equal(resolveControlRoute('/control', '/control/nope').path, '/control/community/reputation');
});

test('deep links win and unknown children safely fall back without loops', () => {
  assert.equal(resolveControlRoute('/control/mappings/roles', '/control/content/live').path, '/control/mappings/roles');
  assert.equal(resolveControlRoute('/control/community/not-real', '/control/content/live').path, '/control/community/reputation');
});
