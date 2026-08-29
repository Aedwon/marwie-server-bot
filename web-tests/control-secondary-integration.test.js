import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { escapeHtml, pageMarkup } from '../docs-site/control-components.js';
import { resolveControlRoute } from '../docs-site/control-router.js';
import { activityPageMarkup } from '../docs-site/control-secondary.js';

const appSource = readFileSync(new URL('../docs-site/control-app.js', import.meta.url), 'utf8');
const cssUrl = new URL('../docs-site/control-secondary.css', import.meta.url);
const secondaryCss = existsSync(cssUrl) ? readFileSync(cssUrl, 'utf8') : '';

test('canonical Commands fallback renders the useful reference surface instead of the placeholder', () => {
  const markup = pageMarkup(resolveControlRoute('/control/commands'), { authenticated: true });
  assert.match(markup, /data-command-task="reputation-award"/);
  assert.match(markup, /data-command-task="ticket-panel-post"/);
  assert.match(markup, /data-command-task="ai-source-poll"/);
  assert.doesNotMatch(markup, /Slash-command administration remains documented/);
});

test('canonical Activity fallback renders controller state instead of placeholder copy', () => {
  const markup = pageMarkup(resolveControlRoute('/control/activity'), {
    authenticated: true,
    activityState: {
      phase: 'ready',
      actorId: '123',
      items: [{
        id: '1',
        actor: { id: '123' },
        summary: 'Updated reputation thresholds',
        status: 'completed',
        timestamp: '2026-08-29T12:00:00Z',
        failure: null,
      }],
      nextCursor: null,
    },
  });
  assert.match(markup, /Updated reputation thresholds/);
  assert.match(markup, /Actor<\/span> You<\/span>/);
  assert.doesNotMatch(markup, /Administrative history is sourced/);
});

test('Control and secondary HTML escapers encode ordinary double quotes', () => {
  assert.equal(escapeHtml('a"b'), 'a&quot;b');
  const markup = activityPageMarkup({
    phase: 'ready',
    items: [{
      id: '1',
      actor: { id: '123' },
      summary: 'Changed "quoted" value',
      status: 'completed',
      timestamp: '2026-08-29T12:00:00Z',
      failure: null,
    }],
    nextCursor: null,
  });
  assert.match(markup, /Changed &quot;quoted&quot; value/);
  assert.doesNotMatch(markup, /Changed "quoted" value/);
});

test('Control shell wires authenticated Activity through the canonical loader and local controller', () => {
  assert.match(appSource, /loadActivity/);
  assert.match(appSource, /createActivityController/);
  assert.match(appSource, /installActivityPage/);
  assert.match(appSource, /activityState/);
  assert.match(appSource, /session\?\.authenticated[\s\S]*guild/);
});

test('secondary surfaces provide wrapping and narrow reflow without event-card styling', () => {
  assert.match(secondaryCss, /\.control-activity-meta/);
  assert.match(secondaryCss, /overflow-wrap:\s*anywhere/);
  assert.match(secondaryCss, /@media\s*\(max-width:\s*560px\)/);
  assert.doesNotMatch(secondaryCss, /activity-card|box-shadow/);
});
