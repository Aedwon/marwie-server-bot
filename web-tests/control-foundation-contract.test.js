import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { CONTROL_DESTINATIONS } from '../docs-site/control-router.js';

const CANONICAL_DESTINATIONS = [
  '/control/community/reputation','/control/community/quizzes','/control/community/voice-coworking','/control/community/showcase',
  '/control/content/feeds','/control/content/announcements','/control/content/live',
  '/control/utilities/ticket-configuration','/control/utilities/notification-roles','/control/utilities/anonymous-questions',
  '/control/analytics','/control/workflows/moderation','/control/workflows/ticket-handling','/control/workflows/events',
  '/control/mappings/channels','/control/mappings/roles','/control/mappings/categories','/control/commands','/control/activity',
];

const actionSource = readFileSync(new URL('../api/action.js', import.meta.url), 'utf8');
const guildStateSource = readFileSync(new URL('../api/guild-state.js', import.meta.url), 'utf8');
const executorUrl = new URL('../src/marwie_bot/features/control_plane/executor.py', import.meta.url);
const executorBaseUrl = new URL('../src/marwie_bot/features/control_plane/executor_base.py', import.meta.url);
const executorSource = readFileSync(executorUrl, 'utf8');
const aiUpdatesCogSource = readFileSync(new URL('../src/marwie_bot/features/ai_updates/cog.py', import.meta.url), 'utf8');
const cogSource = readFileSync(new URL('../src/marwie_bot/features/control_plane/cog.py', import.meta.url), 'utf8');
const snapshotSource = readFileSync(new URL('../src/marwie_bot/features/control_plane/snapshot.py', import.meta.url), 'utf8');

test('approved destination contract is backed by the real router registry', () => {
  const actual = CONTROL_DESTINATIONS.map(item => item.path);
  assert.deepEqual(actual, CANONICAL_DESTINATIONS);
  assert.equal(actual.includes('/control/overview'), false);
  assert.equal(actual.some(path => path.includes('build-help')), false);
});

test('browser mutations remain idempotent, rate bounded and fresh-snapshot gated', () => {
  assert.match(actionSource, /idempotency[_-]key/i);
  assert.match(actionSource, /uq_control_actions_actor_idempotency/);
  assert.match(actionSource, /CURRENT_TIMESTAMP - INTERVAL '3 minutes'/);
  assert.match(actionSource, /rate_count|COUNT\(\*\)/);
});

test('stale snapshot refresh remains an internal durable action path', () => {
  assert.match(guildStateSource, /'refresh_snapshot'/);
  assert.match(guildStateSource, /tryWakeControlWorker/);
  assert.match(guildStateSource, /waitForFreshSnapshot/);
});

test('worker keeps live permission recheck and sanitized unexpected failures in one executor', () => {
  assert.equal(existsSync(executorBaseUrl), false);
  assert.match(executorSource, /_require_actor_permission/);
  assert.match(executorSource, /guild\.fetch_member/);
  assert.match(cogSource, /The action failed unexpectedly\./);
  assert.match(cogSource, /error_reference/);
  assert.match(cogSource, /repository\.fail/);
});

test('snapshot keeps the state families required by approved destinations', () => {
  for (const field of ['resources', 'features', 'ticket_types', 'reputation', 'quiz', 'ai_sources', 'notification_panel']) {
    assert.match(snapshotSource, new RegExp(`['\\"]${field}['\\"]`));
  }
});

test('manual AI polling is Commands-only while scheduled polling retains automatic publishing', () => {
  assert.match(executorSource, /Commands-only/);
  assert.match(executorSource, /\/ai-source poll/);
  assert.doesNotMatch(executorSource, /_poll_source/);

  assert.match(aiUpdatesCogSource, /manual_polling\.preview/);
  assert.match(aiUpdatesCogSource, /class ManualFeedPollView/);
  assert.match(aiUpdatesCogSource, /label="Post"/);
  assert.match(aiUpdatesCogSource, /label="Cancel"/);
  assert.match(aiUpdatesCogSource, /async def _poll_source/);
  assert.match(aiUpdatesCogSource, /_publish_candidates/);
  assert.match(aiUpdatesCogSource, /poll_loop[\s\S]*?_poll_source/);
});
