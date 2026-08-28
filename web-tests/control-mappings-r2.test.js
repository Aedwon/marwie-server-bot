import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  installMappingPageInteractions,
  mappingPageMarkup,
} from '../docs-site/control-mappings.js';

const PAGE_KEYS = {
  channels: '/control/mappings/channels',
  roles: '/control/mappings/roles',
  categories: '/control/mappings/categories',
};

class FakeRoot {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  removeEventListener(type, handler) {
    const handlers = this.listeners.get(type) || [];
    this.listeners.set(type, handlers.filter(item => item !== handler));
  }

  emit(type, target) {
    const event = {
      target,
      preventDefault() {},
    };
    return (this.listeners.get(type) || []).map(handler => handler(event));
  }
}

function fakeTarget(dataset = {}, { checked = false, tagName = 'BUTTON' } = {}) {
  return {
    dataset,
    checked,
    tagName,
    value: '',
    closest(selector) {
      if (selector === '[data-mapping-review]' && 'mappingReview' in dataset) return this;
      if (selector === '[data-mapping-apply-suggestions]' && 'mappingApplySuggestions' in dataset) return this;
      if (selector === '[data-mapping-confirm-key]' && 'mappingConfirmKey' in dataset) return this;
      if (selector === '[data-mapping-edit]' && 'mappingEdit' in dataset) return this;
      if (selector === '[data-mapping-save]' && 'mappingSave' in dataset) return this;
      if (selector === '[data-mapping-discard]' && 'mappingDiscard' in dataset) return this;
      if (selector === '[data-mapping-key]' && 'mappingKey' in dataset) return this;
      return null;
    },
  };
}

function pageState() {
  return {
    persisted: {},
    draft: {},
    errors: {},
    mode: 'read',
    status: 'idle',
    saveError: null,
  };
}

function createReviewSnapshot({ planHash, proposal }) {
  return {
    resources: [],
    channels: [],
    roles: [],
    mappings_review: {
      plan_hash: planHash,
      quiet: false,
      proposed: [proposal],
    },
  };
}

function createProposal({
  key = 'showcase_forum',
  group = 'channels',
  kind = 'forum',
  action = 'create',
  canonicalName = 'showcase',
  current = null,
  target = null,
} = {}) {
  return {
    key,
    group,
    kind,
    action,
    canonical_name: canonicalName,
    current,
    target,
    requires_confirmation: true,
  };
}

function applyButton(markup) {
  const match = markup.match(/<button[^>]*data-mapping-apply-suggestions[^>]*>/);
  assert.ok(match, 'review markup must contain the Apply reviewed mappings button');
  return match[0];
}

function confirmationInput(markup, key) {
  const pattern = new RegExp(`<input[^>]*data-mapping-confirm-key="${key}"[^>]*>`);
  const match = markup.match(pattern);
  assert.ok(match, `review markup must contain the ${key} confirmation checkbox`);
  return match[0];
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  promise.catch(() => {});
  return { promise, resolve, reject };
}

async function settleHandlerResults(results) {
  const promises = results.filter(result => result && typeof result.then === 'function');
  await Promise.all(promises.map(promise => promise.catch(() => {})));
  await Promise.resolve();
}

test('changed mapping review plan hash discards old consequence confirmations before apply', () => {
  const pageKey = PAGE_KEYS.channels;
  const proposal = createProposal();
  const snapshotA = createReviewSnapshot({ planHash: '1'.repeat(64), proposal });
  const snapshotB = createReviewSnapshot({ planHash: '2'.repeat(64), proposal });
  const state = pageState();
  const payloadsA = [];
  const rootA = new FakeRoot();

  const removeA = installMappingPageInteractions({
    root: rootA,
    pageKey,
    snapshot: snapshotA,
    onApplySuggestions: payload => payloadsA.push(payload),
    rerender() {},
  });
  try {
    rootA.emit('click', fakeTarget({ mappingReview: '' }));
    rootA.emit('change', fakeTarget(
      { mappingConfirmKey: 'showcase_forum' },
      { checked: true, tagName: 'INPUT' },
    ));

    const confirmedA = mappingPageMarkup({ pageKey, state, snapshot: snapshotA });
    assert.match(confirmationInput(confirmedA, 'showcase_forum'), / checked/);
    assert.doesNotMatch(applyButton(confirmedA), / disabled/);

    rootA.emit('click', fakeTarget({ mappingApplySuggestions: '' }));
    assert.deepEqual(payloadsA[0].confirmed_keys, ['showcase_forum']);
  } finally {
    removeA();
  }

  const payloadsB = [];
  const rootB = new FakeRoot();
  const removeB = installMappingPageInteractions({
    root: rootB,
    pageKey,
    snapshot: snapshotB,
    onApplySuggestions: payload => payloadsB.push(payload),
    rerender() {},
  });
  try {
    const freshB = mappingPageMarkup({ pageKey, state, snapshot: snapshotB });
    assert.doesNotMatch(confirmationInput(freshB, 'showcase_forum'), / checked/);
    assert.match(applyButton(freshB), / disabled/);

    rootB.emit('change', fakeTarget(
      { mappingConfirmKey: 'showcase_forum' },
      { checked: true, tagName: 'INPUT' },
    ));
    const reconfirmedB = mappingPageMarkup({ pageKey, state, snapshot: snapshotB });
    assert.match(confirmationInput(reconfirmedB, 'showcase_forum'), / checked/);
    assert.doesNotMatch(applyButton(reconfirmedB), / disabled/);

    rootB.emit('click', fakeTarget({ mappingApplySuggestions: '' }));
    assert.deepEqual(payloadsB[0].confirmed_keys, ['showcase_forum']);
    assert.equal(payloadsB[0].plan_hash, '2'.repeat(64));
  } finally {
    removeB();
  }
});

test('unchanged mapping review plan preserves explicit confirmations across rerender/install', () => {
  const pageKey = PAGE_KEYS.categories;
  const snapshot = createReviewSnapshot({
    planHash: '3'.repeat(64),
    proposal: createProposal({
      key: 'ticket_category',
      group: 'categories',
      kind: 'category',
      canonicalName: 'TICKETS',
    }),
  });
  const state = pageState();
  const root = new FakeRoot();

  const remove = installMappingPageInteractions({
    root,
    pageKey,
    snapshot,
    rerender() {},
  });
  try {
    root.emit('click', fakeTarget({ mappingReview: '' }));
    root.emit('change', fakeTarget(
      { mappingConfirmKey: 'ticket_category' },
      { checked: true, tagName: 'INPUT' },
    ));
    const confirmed = mappingPageMarkup({ pageKey, state, snapshot });
    assert.match(confirmationInput(confirmed, 'ticket_category'), / checked/);
  } finally {
    remove();
  }

  const replacementRoot = new FakeRoot();
  const removeReplacement = installMappingPageInteractions({
    root: replacementRoot,
    pageKey,
    snapshot,
    rerender() {},
  });
  try {
    const unchanged = mappingPageMarkup({ pageKey, state, snapshot });
    assert.match(confirmationInput(unchanged, 'ticket_category'), / checked/);
    assert.doesNotMatch(applyButton(unchanged), / disabled/);
  } finally {
    removeReplacement();
  }
});

test('mapping apply owns accessible local applying and success feedback, blocks duplicates, and clears applied confirmations', async () => {
  const pageKey = PAGE_KEYS.roles;
  const snapshot = createReviewSnapshot({
    planHash: '4'.repeat(64),
    proposal: createProposal({
      key: 'mentor_role',
      group: 'roles',
      kind: 'role',
      action: 'remap',
      canonicalName: 'Mentor',
      current: { id: '10', name: 'Old Mentor' },
      target: { id: '11', name: 'Mentor' },
    }),
  });
  const state = pageState();
  const root = new FakeRoot();
  const pending = deferred();
  let applyCalls = 0;

  const remove = installMappingPageInteractions({
    root,
    pageKey,
    snapshot,
    onApplySuggestions() {
      applyCalls += 1;
      return pending.promise;
    },
    rerender() {},
  });
  try {
    root.emit('click', fakeTarget({ mappingReview: '' }));
    root.emit('change', fakeTarget(
      { mappingConfirmKey: 'mentor_role' },
      { checked: true, tagName: 'INPUT' },
    ));

    const handlerResults = root.emit('click', fakeTarget({ mappingApplySuggestions: '' }));
    assert.equal(applyCalls, 1);

    const applying = mappingPageMarkup({ pageKey, state, snapshot });
    assert.match(applying, /role="status"/);
    assert.match(applying, /Applying reviewed mapping changes/);
    assert.match(applyButton(applying), / disabled/);

    root.emit('click', fakeTarget({ mappingApplySuggestions: '' }));
    assert.equal(applyCalls, 1, 'a pending mapping apply must not be submitted twice');

    pending.resolve();
    await settleHandlerResults(handlerResults);

    const success = mappingPageMarkup({ pageKey, state, snapshot });
    assert.match(success, /role="status"/);
    assert.match(success, /Reviewed mappings applied/);
    assert.doesNotMatch(confirmationInput(success, 'mentor_role'), / checked/);
    assert.match(applyButton(success), / disabled/);
  } finally {
    remove();
  }
});

test('mapping apply failure stays local and accessible until retry or review-state change', async () => {
  const pageKey = PAGE_KEYS.categories;
  const snapshot = createReviewSnapshot({
    planHash: '5'.repeat(64),
    proposal: createProposal({
      key: 'temp_voice_category',
      group: 'categories',
      kind: 'category',
      canonicalName: 'TEMP VOICE',
    }),
  });
  const state = pageState();
  const root = new FakeRoot();
  const firstAttempt = deferred();
  const secondAttempt = deferred();
  let attempt = 0;

  const remove = installMappingPageInteractions({
    root,
    pageKey,
    snapshot,
    onApplySuggestions() {
      attempt += 1;
      return attempt === 1 ? firstAttempt.promise : secondAttempt.promise;
    },
    rerender() {},
  });
  try {
    root.emit('click', fakeTarget({ mappingReview: '' }));
    root.emit('change', fakeTarget(
      { mappingConfirmKey: 'temp_voice_category' },
      { checked: true, tagName: 'INPUT' },
    ));

    const failedResults = root.emit('click', fakeTarget({ mappingApplySuggestions: '' }));
    firstAttempt.reject(new Error('Discord rejected the reviewed mapping plan.'));
    await settleHandlerResults(failedResults);

    const failed = mappingPageMarkup({ pageKey, state, snapshot });
    assert.match(failed, /role="alert"/);
    assert.match(failed, /Discord rejected the reviewed mapping plan\./);

    const retryResults = root.emit('click', fakeTarget({ mappingApplySuggestions: '' }));
    const retrying = mappingPageMarkup({ pageKey, state, snapshot });
    assert.match(retrying, /role="status"/);
    assert.match(retrying, /Applying reviewed mapping changes/);
    assert.doesNotMatch(retrying, /Discord rejected the reviewed mapping plan\./);

    secondAttempt.resolve();
    await settleHandlerResults(retryResults);
  } finally {
    remove();
  }
});

test('ordinary mapping apply lifecycle does not write the shell-global status channel', () => {
  const source = readFileSync(new URL('../docs-site/control-app.js', import.meta.url), 'utf8');
  const match = source.match(/async function requestMappingSuggestions\(payload\) \{[\s\S]*?\n\}\n\n/);
  assert.ok(match, 'requestMappingSuggestions must remain an identifiable app-layer boundary');
  assert.doesNotMatch(match[0], /\bsetStatus\s*\(/);
});
