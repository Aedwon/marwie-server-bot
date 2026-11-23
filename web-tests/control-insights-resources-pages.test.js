import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { toggleDisclosure } from '../docs-site/control-components.js?v=28';
import { workflowPageMarkup } from '../docs-site/control-workflows.js';
import { activityPageMarkup } from '../docs-site/control-secondary.js';
import { analyticsPageMarkup } from '../docs-site/control-analytics.js';
import { createMappingPageDefinition, installMappingPageInteractions, mappingPageMarkup } from '../docs-site/control-mappings.js';
import { createControlStateStore } from '../docs-site/control-state.js';
import { animateSegmentedThumbs, segmentedControlMarkup } from '../docs-site/control-page-parts.js';
import { insightsSnapshot } from './fixtures/stage2b-insights-scenarios.js';

const CHANNELS = '/control/mappings/channels';

function fakeToggle(markup, id) {
  const container = { dataset: { disclosure: id, open: markup.includes(`data-disclosure="${id}" data-open="true"`) ? 'true' : 'false' }, querySelector: () => body };
  const body = { inert: container.dataset.open !== 'true' };
  const attributes = {};
  return { container, body, attributes, button: {
    closest: () => container,
    setAttribute(name, value) { attributes[name] = value; },
  } };
}

test('playbook steps disclose with aria-expanded and the first step starts open', () => {
  const markup = workflowPageMarkup('/control/workflows/events');
  const triggers = [...markup.matchAll(/data-disclosure-toggle aria-expanded="(true|false)" aria-controls="(control-disclosure-playbook-events-\d)"/g)];
  assert.deepEqual(triggers.map(match => match[1]), ['true', 'false', 'false', 'false']);
  const second = fakeToggle(markup, 'playbook-events-2');
  assert.equal(toggleDisclosure(second.button), true);
  assert.equal(second.attributes['aria-expanded'], 'true');
  assert.equal(second.body.inert, false);
  assert.equal(toggleDisclosure(second.button), false);
  assert.equal(second.attributes['aria-expanded'], 'false');
  assert.match(markup, /class="workflow-step-number" aria-hidden="true">1</);
  assert.match(markup, /href="\/control\/content\/announcements"/);
});

test('no Stage 2b page renders chips, dotted markup, Edit settings or a Details panel', () => {
  const analytics = analyticsPageMarkup({
    state: { mode: 'edit', status: 'clean', persisted: { enabled: true }, draft: { enabled: true } },
    snapshot: { analytics: { moderation_cases: 1 } },
  });
  const activity = activityPageMarkup({
    phase: 'ready',
    items: [{ id: '1', actor: { id: '1' }, summary: 'Saved Quizzes settings', status: 'completed', timestamp: '2026-08-29T12:00:00Z', failure: null }],
  });
  const store = createControlStateStore();
  const definition = createMappingPageDefinition(CHANNELS);
  store.register(definition);
  store.hydrate(CHANNELS, insightsSnapshot(), 'a'.repeat(64));
  const resources = mappingPageMarkup({ pageKey: CHANNELS, state: store.get(CHANNELS), snapshot: insightsSnapshot() });
  for (const markup of [analytics, activity, resources, workflowPageMarkup('/control/workflows/ticket-handling')]) {
    assert.doesNotMatch(markup, /control-state-chip|status-pill|status-badge|status-dot|control-context-status|Edit settings|data-control-details|control-task-status/);
  }
});

test('segmented control starts the thumb at the previous position and moves it to the target', () => {
  const options = ['a', 'b', 'c'].map(key => ({ key, label: key.toUpperCase() }));
  const first = segmentedControlMarkup({ id: 'seg-test', label: 'Test', options, selected: 'a' });
  assert.match(first, /data-index="0" data-seg-target="0"/);
  const attributes = { 'data-seg-target': '2', 'data-segn': 'seg-test', 'data-index': '0' };
  const control = { getAttribute: name => attributes[name], setAttribute(name, value) { attributes[name] = value; }, offsetWidth: 1 };
  animateSegmentedThumbs({ querySelectorAll: () => [control] });
  assert.equal(typeof requestAnimationFrame, 'undefined');
  assert.equal(attributes['data-index'], '2');
  const second = segmentedControlMarkup({ id: 'seg-test', label: 'Test', options, selected: 'c' });
  assert.match(second, /data-index="2" data-seg-target="2"/);
});

test('Resources tabs link the three existing routes and the thumb follows the active tab', () => {
  const store = createControlStateStore();
  const roles = '/control/mappings/roles';
  const definition = createMappingPageDefinition(roles);
  store.register(definition);
  store.hydrate(roles, insightsSnapshot(), 'a'.repeat(64));
  const markup = mappingPageMarkup({ pageKey: roles, state: store.get(roles), snapshot: insightsSnapshot() });
  assert.deepEqual([...markup.matchAll(/class="control-segn-item" href="([^"]+)"/g)].map(match => match[1]), [
    '/control/mappings/channels', '/control/mappings/roles', '/control/mappings/categories',
  ]);
  assert.match(markup, /data-seg-target="1"/);
  assert.match(markup, /href="\/control\/mappings\/roles"[^>]*aria-current="page">Roles</);
});

class Root {
  constructor() { this.handlers = new Map(); this.wrap = null; }
  addEventListener(type, handler) { this.handlers.set(type, handler); }
  removeEventListener(type) { this.handlers.delete(type); }
  querySelector(selector) { return selector === '[data-suggestions-wrap]' ? this.wrap : null; }
}

test('Suggest matches opens the review inline without a rerender and Apply reviewed matches keeps its payload', async () => {
  const snapshot = insightsSnapshot();
  snapshot.mappings_review = {
    plan_hash: 'c'.repeat(64),
    quiet: false,
    proposed: [{ key: 'quiz_channel', group: 'channels', kind: 'text', action: 'bind', canonical_name: 'quiz', current: null, target: { id: '260', name: 'general' }, requires_confirmation: false }],
  };
  const pageKey = '/control/mappings/categories';
  const store = createControlStateStore();
  store.register(createMappingPageDefinition(pageKey));
  store.hydrate(pageKey, snapshot, 'a'.repeat(64));
  store.beginEdit(pageKey);
  const closed = mappingPageMarkup({ pageKey, state: store.get(pageKey), snapshot });
  assert.match(closed, /aria-expanded="false" aria-controls="mapping-suggestions-body">Suggest matches</);
  assert.match(closed, />Apply reviewed matches</);

  const root = new Root();
  const body = { inert: true };
  const wrap = { dataset: { open: 'false' }, querySelector: () => body };
  root.wrap = wrap;
  let rerenders = 0;
  const applied = [];
  installMappingPageInteractions({ root, pageKey, store, snapshot, rerender: () => { rerenders += 1; }, onApplySuggestions: async payload => { applied.push(payload); return { snapshot }; } });
  const aria = {};
  const review = { closest: selector => (selector === '[data-mapping-review]' ? review : null), setAttribute: (name, value) => { aria[name] = value; } };
  await root.handlers.get('click')({ target: review });
  assert.equal(wrap.dataset.open, 'true');
  assert.equal(body.inert, false);
  assert.equal(aria['aria-expanded'], 'true');
  assert.equal(rerenders, 0);
  assert.match(mappingPageMarkup({ pageKey, state: store.get(pageKey), snapshot }), /data-suggestions-wrap data-open="true"/);

  const apply = { closest: selector => (selector === '[data-mapping-apply-suggestions]' ? apply : null) };
  await root.handlers.get('click')({ target: apply });
  assert.deepEqual(applied, [{
    plan_hash: 'c'.repeat(64),
    items: [{ key: 'quiz_channel', action: 'bind', target_id: '260' }],
    confirmed_keys: [],
  }]);
  await root.handlers.get('click')({ target: review });
});

test('Stage 2b CSS keeps motion on tokens and adds no looping animation', () => {
  const css = readFileSync(new URL('../docs-site/control-features.css', import.meta.url), 'utf8').split('/* Stage 2b: insights, resources and playbooks */')[1];
  assert.ok(css.length > 500);
  assert.doesNotMatch(css, /infinite|@keyframes/);
  for (const [, duration] of css.matchAll(/transition:[^;]*?(\d+m?s)/g)) assert.fail(`literal duration ${duration}`);
  assert.match(css, /\.control-segn-thumb\s*\{[^}]*transition:\s*transform var\(--motion-enter\) var\(--ease-out\)/);
  assert.match(css, /prefers-reduced-motion: reduce\)\s*\{\s*\.control-segn-thumb\s*\{\s*transition:\s*none/);
});
