import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { HttpError, requireGuild } from '../api/_lib/control.js';
import { resolveControlRoute } from '../docs-site/control-router.js';
import {
  activityPageMarkup,
  commandsPageMarkup,
  createActivityController,
} from '../docs-site/control-secondary.js';

const commandsManual = readFileSync(new URL('../docs/commands.md', import.meta.url), 'utf8');
const deployedCommandsManual = readFileSync(new URL('../docs-site/commands.md', import.meta.url), 'utf8');
const communitySource = readFileSync(new URL('../docs-site/control-community.js', import.meta.url), 'utf8');
const contentSource = readFileSync(new URL('../docs-site/control-content.js', import.meta.url), 'utf8');
const utilitiesSource = readFileSync(new URL('../docs-site/control-utilities.js', import.meta.url), 'utf8');

test('Commands renders exactly the three approved Discord-admin references and canonical deep links', () => {
  const markup = commandsPageMarkup();
  assert.match(markup, /<h1>Commands<\/h1>/);
  assert.equal((markup.match(/data-command-task=/g) || []).length, 3);
  assert.match(markup, /<code class="control-command-chip">\/reputation award<\/code>/);
  assert.match(markup, /href="\/commands#command-reputation-award"[^>]*>Open guide<\/a>/);
  assert.match(markup, /<code class="control-command-chip">\/ticket-panel post<\/code>/);
  assert.match(markup, /href="\/commands#command-ticket-panel-post"[^>]*>Open guide<\/a>/);
  assert.match(markup, /<code class="control-command-chip">\/ai-source poll<\/code>/);
  assert.match(markup, /href="\/commands#command-ai-source-poll"[^>]*>Open guide<\/a>/);
  assert.match(markup, /href="\/commands"[^>]*>Open the full Commands manual<\/a>/);
  assert.doesNotMatch(markup, /<(?:form|button|input|select|textarea)\b/i);
  assert.doesNotMatch(markup, /adjust_reputation|refresh_ticket_panel|poll_ai_sources|enqueueControlAction/);
});

test('Commands reuses the synchronized 43-command canonical manual without duplicating its catalog', () => {
  assert.equal(commandsManual, deployedCommandsManual);
  assert.equal((commandsManual.match(/^##\s+`\/[^`]+`\s*$/gm) || []).length, 43);
  const markup = commandsPageMarkup();
  assert.equal((markup.match(/data-command-task=/g) || []).length, 3);
  assert.doesNotMatch(markup, /45 commands|command count|implementation|authentication architecture/i);
});

test('Commands-only operations remain absent from their canonical feature modules', () => {
  assert.doesNotMatch(communitySource, /adjust_reputation|manual reputation/i);
  assert.doesNotMatch(utilitiesSource, /refresh_ticket_panel|refresh \/ repost panel/i);
  assert.doesNotMatch(contentSource, /poll_ai_sources|>\s*Poll now\s*</i);
});

test('Commands and Activity remain direct secondary routes', () => {
  for (const path of ['/control/commands', '/control/activity']) {
    const route = resolveControlRoute(path);
    assert.equal(route.path, path);
    assert.equal(route.kind, 'secondary');
    assert.equal(route.domain, null);
  }
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
  assert.match(markup, /Actor<\/span> You<\/span>/);
  assert.match(markup, /Discord user 222/);
  assert.match(markup, /Updated a quiz question/);
  assert.match(markup, />Completed</);
  assert.match(markup, />Failed</);
  assert.match(markup, /<time datetime="2026-08-29T12:00:00.000Z"/);
  assert.match(markup, /Could not post\./);
  assert.match(markup, /REF123/);
  assert.match(markup, /data-activity-load-more/);
  assert.doesNotMatch(markup, /never render me|never render result|payload_json|result_json/);
  assert.doesNotMatch(markup, /<article[^>]*card|activity-card|data-action-type/);
});

test('Activity renders local loading, empty, error, and terminal pagination states', () => {
  assert.match(activityPageMarkup({ phase: 'loading', items: [] }), /role="status"[^>]*>Loading activity/);
  assert.match(activityPageMarkup({ phase: 'ready', items: [], nextCursor: null }), /No administrative activity yet/);
  const error = activityPageMarkup({ phase: 'error', items: [], error: 'Activity could not be loaded.' });
  assert.match(error, /role="alert"/);
  assert.match(error, /data-activity-retry/);
  const terminal = activityPageMarkup({ phase: 'ready', items: [{ id: 'a', actor: { id: '1' }, summary: 'Updated a mapping', status: 'completed', timestamp: '2026-08-29T12:00:00Z', failure: null }], nextCursor: null });
  assert.doesNotMatch(terminal, /data-activity-load-more/);
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
