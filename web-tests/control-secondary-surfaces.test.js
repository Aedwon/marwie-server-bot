import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { HttpError, requireGuild } from '../api/_lib/control.js';
import { resolveControlRoute } from '../docs-site/control-router.js';
import {
  activityPageMarkup,
  createActivityController,
  relativeTimeLabel,
} from '../docs-site/control-secondary.js';

const commandsManual = readFileSync(new URL('../docs/commands.md', import.meta.url), 'utf8');
const deployedCommandsManual = readFileSync(new URL('../docs-site/commands.md', import.meta.url), 'utf8');
const communitySource = readFileSync(new URL('../docs-site/control-community.js', import.meta.url), 'utf8');
const contentSource = readFileSync(new URL('../docs-site/control-content.js', import.meta.url), 'utf8');
const utilitiesSource = readFileSync(new URL('../docs-site/control-utilities.js', import.meta.url), 'utf8');

test('Control has no Commands page of its own and links to the single manual', async () => {
  const secondary = await import('../docs-site/control-secondary.js');
  assert.equal(secondary.commandsPageMarkup, undefined);
  const source = readFileSync(new URL('../docs-site/control-secondary.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /COMMAND_TASKS|data-command-task|\/control\/commands/);
});

test('Commands reuses the synchronized 43-command canonical manual without duplicating its catalog', () => {
  assert.equal(commandsManual, deployedCommandsManual);
  assert.equal((commandsManual.match(/^##\s+`\/[^`]+`\s*$/gm) || []).length, 43);
  assert.doesNotMatch(commandsManual, /45 commands/i);
});

test('Commands-only operations remain absent from their canonical feature modules', () => {
  assert.doesNotMatch(communitySource, /adjust_reputation|manual reputation/i);
  assert.doesNotMatch(utilitiesSource, /refresh_ticket_panel|refresh \/ repost panel/i);
  assert.doesNotMatch(contentSource, /poll_ai_sources|>\s*Poll now\s*</i);
});

test('Activity remains a direct secondary route and Commands is not a Control route', () => {
  const route = resolveControlRoute('/control/activity');
  assert.equal(route.path, '/control/activity');
  assert.equal(route.kind, 'secondary');
  assert.equal(route.domain, null);
  assert.notEqual(resolveControlRoute('/control/commands').path, '/control/commands');
});

test('Activity markup is semantic, human-readable, and keeps raw backend data out of the DOM', () => {
  const markup = activityPageMarkup({
    phase: 'ready',
    actorId: '111',
    items: [
      {
        id: 'a',
        actor: { id: '111' },
        summary: 'Updated a quiz question',
        status: 'completed',
        timestamp: '2026-08-29T12:00:00.000Z',
        failure: null,
        payload_json: { secret: 'never render me' },
        result_json: { secret: 'never render result' },
      },
      {
        id: 'b',
        actor: { id: '222' },
        summary: 'Sent an announcement',
        status: 'failed',
        timestamp: '2026-08-29T11:00:00.000Z',
        failure: { message: 'Could not post.', reference: 'REF123' },
      },
    ],
    nextCursor: 'opaque-next',
    error: null,
    loadingMore: false,
  });

  assert.match(markup, /<h1>Activity<\/h1>/);
  assert.match(markup, /<ol[^>]*control-activity-list/);
  assert.equal((markup.match(/<li\b/g) || []).length, 2);
  assert.match(markup, /<span class="control-activity-actor">You<\/span>/);
  assert.match(markup, /Discord user 222/);
  assert.match(markup, /Updated a quiz question/);
  assert.doesNotMatch(markup, /Completed|data-task-indicator|control-task-status/);
  assert.match(markup, /<span class="control-activity-status" data-status="failed"><svg[^>]*>[\s\S]*?<\/svg><span>Failed<\/span><\/span>/);
  assert.match(markup, /<time datetime="2026-08-29T12:00:00.000Z" title="[^"]+">/);
  assert.equal((markup.match(/data-disclosure-toggle aria-expanded="false"/g) || []).length, 2);
  assert.match(markup, /<dt>Problem<\/dt><dd>Could not post\.<\/dd>/);
  assert.match(markup, /<dt>Reference<\/dt><dd>REF123<\/dd>/);
  assert.match(markup, /data-activity-load-more/);
  assert.doesNotMatch(markup, /never render me|never render result|payload_json|result_json/);
  assert.doesNotMatch(markup, /<article[^>]*card|activity-card|data-action-type/);
});

test('Activity renders local loading, empty, error, and terminal pagination states', () => {
  const loading = activityPageMarkup({ phase: 'loading', items: [] });
  assert.match(loading, /role="status"/);
  assert.match(loading, /data-task-indicator[^>]*data-state="running"[^>]*data-size="18"/);
  assert.match(loading, /Loading activity…/);
  assert.match(activityPageMarkup({ phase: 'ready', items: [], nextCursor: null }), /No administrative activity yet/);
  const error = activityPageMarkup({ phase: 'error', items: [], error: 'Activity could not be loaded.' });
  assert.match(error, /role="alert"/);
  assert.match(error, /data-activity-retry/);
  const terminal = activityPageMarkup({ phase: 'ready', items: [{ id: 'a', actor: { id: '1' }, summary: 'Updated a mapping', status: 'completed', timestamp: '2026-08-29T12:00:00Z', failure: null }], nextCursor: null });
  assert.doesNotMatch(terminal, /data-activity-load-more/);
});

test('Activity shows status as words only when not completed and keeps the indicator for loading', () => {
  const rows = activityPageMarkup({
    phase: 'ready',
    items: [
      { id: 'q', actor: { id: '1' }, summary: 'Queued work', status: 'queued', timestamp: '2026-08-29T12:00:00Z', failure: null },
      { id: 'r', actor: { id: '1' }, summary: 'Running work', status: 'claimed', timestamp: '2026-08-29T12:01:00Z', failure: null },
      { id: 'd', actor: { id: '1' }, summary: 'Finished work', status: 'completed', timestamp: '2026-08-29T12:02:00Z', failure: null },
      { id: 'x', actor: { id: '1' }, summary: 'Rejected work', status: 'rejected', timestamp: '2026-08-29T12:03:00Z', failure: null },
    ],
    nextCursor: 'next',
    loadingMore: true,
  });
  assert.match(rows, /data-status="queued">Queued</);
  assert.match(rows, /data-status="claimed">In progress</);
  assert.match(rows, /data-status="failed"><svg[^>]*>[\s\S]*?<span>Rejected</);
  assert.equal((rows.match(/class="control-activity-status"/g) || []).length, 3);
  assert.equal((rows.match(/data-task-indicator/g) || []).length, 1);
  assert.match(rows, /data-activity-load-more[^>]*disabled[^>]*>[\s\S]*data-state="running"[^>]*data-size="16"/);
});

test('Activity shows relative time with the absolute time in the title and newest first order as given', () => {
  const now = Date.parse('2026-08-29T15:00:00Z');
  assert.equal(relativeTimeLabel('2026-08-29T14:59:50Z', { now, locale: 'en-US' }), 'Just now');
  assert.equal(relativeTimeLabel('2026-08-29T12:00:00Z', { now, locale: 'en-US' }), '3 hours ago');
  assert.equal(relativeTimeLabel('2026-08-28T15:00:00Z', { now, locale: 'en-US' }), 'yesterday');
  assert.equal(relativeTimeLabel('', { now }), 'Time unavailable');
  const markup = activityPageMarkup({
    phase: 'ready', now, locale: 'en-US',
    items: [
      { id: 'n', actor: { id: '1' }, summary: 'Newest', status: 'completed', timestamp: '2026-08-29T14:00:00Z', failure: null },
      { id: 'o', actor: { id: '1' }, summary: 'Oldest', status: 'completed', timestamp: '2026-08-29T09:00:00Z', failure: null },
    ],
  });
  assert.match(markup, /title="[^"]+">1 hour ago<\/time>/);
  assert.ok(markup.indexOf('Newest') < markup.indexOf('Oldest'));
});

test('Activity controller performs one initial load and appends later pages in API order', async () => {
  const calls = [];
  const pages = [
    { items: [{ id: 'newest' }, { id: 'middle' }], next_cursor: 'cursor-1' },
    { items: [{ id: 'oldest' }], next_cursor: null },
  ];
  const controller = createActivityController({
    guildId: '123',
    actorId: '111',
    loadPage: async (_guildId, { cursor }) => {
      calls.push(cursor);
      return pages[calls.length - 1];
    },
  });

  await controller.loadInitial();
  assert.deepEqual(controller.state.items.map(item => item.id), ['newest', 'middle']);
  assert.equal(controller.state.nextCursor, 'cursor-1');
  await controller.loadMore();
  assert.deepEqual(controller.state.items.map(item => item.id), ['newest', 'middle', 'oldest']);
  assert.equal(controller.state.nextCursor, null);
  assert.deepEqual(calls, [null, 'cursor-1']);
});

test('Activity controller blocks duplicate pagination requests and supports local retry', async () => {
  let resolvePage;
  let calls = 0;
  const controller = createActivityController({
    guildId: '123',
    loadPage: async () => {
      calls += 1;
      if (calls === 1) return { items: [{ id: 'one' }], next_cursor: 'next' };
      if (calls === 2) return await new Promise(resolve => { resolvePage = resolve; });
      return { items: [{ id: 'two' }], next_cursor: null };
    },
  });
  await controller.loadInitial();
  const first = controller.loadMore();
  const duplicate = controller.loadMore();
  assert.equal(first, duplicate);
  assert.equal(calls, 2);
  resolvePage({ items: [{ id: 'two' }], next_cursor: null });
  await first;
  assert.equal(controller.state.loadingMore, false);

  let attempts = 0;
  const retrying = createActivityController({
    guildId: '123',
    loadPage: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('Temporary read failure');
      return { items: [], next_cursor: null };
    },
  });
  await retrying.loadInitial();
  assert.equal(retrying.state.phase, 'error');
  assert.equal(retrying.state.error, 'Temporary read failure');
  await retrying.retry();
  assert.equal(retrying.state.phase, 'ready');
  assert.equal(attempts, 2);
});

test('Activity controller never reads before a guild is available', async () => {
  let calls = 0;
  const controller = createActivityController({ guildId: null, loadPage: async () => { calls += 1; return { items: [], next_cursor: null }; } });
  await controller.loadInitial();
  assert.equal(calls, 0);
  assert.equal(controller.state.phase, 'idle');
});

test('Activity authorization rejects guilds outside the session Manage Server set', () => {
  const session = { guilds: [{ id: '123', permissions: '32' }] };
  assert.equal(requireGuild(session, '123').id, '123');
  assert.throws(() => requireGuild(session, '999'), error => error instanceof HttpError && error.status === 403);
});
