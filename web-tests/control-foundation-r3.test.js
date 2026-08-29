import assert from 'node:assert/strict';
import test from 'node:test';

import { pageMarkup } from '../docs-site/control-components.js';
import { resolveControlRoute } from '../docs-site/control-router.js';

test('workflow renderer is guidance-only without duplicated page status chrome', () => {
  for (const path of [
    '/control/workflows/moderation',
    '/control/workflows/ticket-handling',
    '/control/workflows/events',
  ]) {
    const destination = resolveControlRoute(path);
    const markup = pageMarkup(destination, {
      authenticated: true,
      state: { bot: { online: true } },
      snapshot: { fresh: true, updated_at: '2026-08-28T03:00:00Z' },
    });

    assert.match(markup, new RegExp(`<h1>${destination.label}</h1>`));
    assert.match(markup, /Operational guidance/);
    assert.doesNotMatch(markup, /control-eyebrow/);
    assert.doesNotMatch(markup, /control-state-chip/);
    assert.doesNotMatch(markup, /control-read-summary/);
    assert.doesNotMatch(markup, /<(?:form|input|select|textarea|button)\b/i);
    assert.doesNotMatch(markup, /Edit settings|Save changes/i);
  }
});

test('generic fallback renderer avoids repeating shell-level health metadata', () => {
  const destination = resolveControlRoute('/control/analytics');
  const markup = pageMarkup(destination, {
    authenticated: true,
    state: { bot: { online: true } },
    snapshot: { fresh: true, updated_at: '2026-08-28T03:00:00Z' },
  });

  assert.match(markup, /<h1>Analytics<\/h1>/);
  assert.match(markup, /Review the current Rob-bot state for Analytics\./);
  assert.doesNotMatch(markup, /control-eyebrow/);
  assert.doesNotMatch(markup, /control-state-chip/);
  assert.doesNotMatch(markup, /control-read-summary/);
  assert.doesNotMatch(markup, /Fresh server state|Snapshot:|Rob-bot:/);
});
