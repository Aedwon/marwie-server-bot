import assert from 'node:assert/strict';
import test from 'node:test';

import { createControlStateStore } from '../docs-site/control-state.js';

const PAGE_KEY = '/control/mappings/channels';
const WARNING = 'Any human who sends a new message in this channel will trigger automatic compromised-account enforcement.';
const MODULE_URL = new URL('../docs-site/control-mappings.js', import.meta.url);

async function mappingsModule() {
  return await import(MODULE_URL.href);
}

function snapshot({ trapId = null, trapExists = false } = {}) {
  return {
    bot: { top_role_position: 10 },
    resources: [
      { key: 'moderation_log', id: '100', name: 'moderation-log', exists: true, kind: 'text' },
      {
        key: 'compromised_account_trap',
        id: trapId,
        name: trapExists ? 'account-safety' : null,
        exists: trapExists,
        kind: trapId == null ? null : 'text',
      },
    ],
    channels: [
      { id: '100', name: 'moderation-log', kind: 'text', category_id: null },
      { id: '101', name: 'account-safety', kind: 'text', category_id: null },
      { id: '102', name: 'account-safety-2', kind: 'text', category_id: null },
      { id: '103', name: 'general', kind: 'text', category_id: null },
    ],
    roles: [],
    mappings_review: {
      plan_hash: 'a'.repeat(64),
      quiet: false,
      proposed: [],
    },
  };
}

function pageStore(definition, currentSnapshot) {
  const store = createControlStateStore();
  store.register(definition);
  store.hydrate(PAGE_KEY, currentSnapshot, 'b'.repeat(64));
  store.beginEdit(PAGE_KEY);
  return store;
}

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
    const event = { target, preventDefault() {} };
    for (const handler of this.listeners.get(type) || []) handler(event);
  }
}

function mappingTarget(key, value) {
  return {
    dataset: { mappingKey: key },
    value,
    tagName: 'SELECT',
    closest(selector) {
      if (selector === '[data-mapping-key]') return this;
      return null;
    },
  };
}

function destructiveConfirmationTarget(checked) {
  return {
    dataset: { mappingDestructiveConfirm: 'compromised_account_trap' },
    checked,
    tagName: 'INPUT',
    closest(selector) {
      if (selector === '[data-mapping-destructive-confirm]') return this;
      return null;
    },
  };
}

test('Channels owns the manual-only compromised account trap mapping', async () => {
  const { MAPPING_PAGE_CONFIGS, MAPPING_RESOURCE_DEFINITIONS } = await mappingsModule();

  assert.equal(MAPPING_PAGE_CONFIGS[PAGE_KEY].resourceKeys.includes('compromised_account_trap'), true);
  assert.deepEqual(MAPPING_RESOURCE_DEFINITIONS.compromised_account_trap, {
    label: 'Compromised account trap',
    group: 'channels',
    kind: 'text',
    manualOnly: true,
    destructive: true,
    warning: WARNING,
  });
});

test('trap read status distinguishes Armed, Unavailable, and Not connected', async () => {
  const { createMappingPageDefinition, mappingPageMarkup } = await mappingsModule();
  const definition = createMappingPageDefinition(PAGE_KEY);

  const healthySnapshot = snapshot({ trapId: '101', trapExists: true });
  const healthyStore = createControlStateStore();
  healthyStore.register(definition);
  healthyStore.hydrate(PAGE_KEY, healthySnapshot, 'c'.repeat(64));
  const healthyMarkup = mappingPageMarkup({
    pageKey: PAGE_KEY,
    state: healthyStore.get(PAGE_KEY),
    snapshot: healthySnapshot,
  });
  assert.match(healthyMarkup, /data-mapping-key="compromised_account_trap"[\s\S]*>Armed</);

  const staleDefinition = createMappingPageDefinition(PAGE_KEY);
  const staleSnapshot = snapshot({ trapId: '999', trapExists: false });
  const staleStore = createControlStateStore();
  staleStore.register(staleDefinition);
  staleStore.hydrate(PAGE_KEY, staleSnapshot, 'd'.repeat(64));
  const staleMarkup = mappingPageMarkup({
    pageKey: PAGE_KEY,
    state: staleStore.get(PAGE_KEY),
    snapshot: staleSnapshot,
  });
  assert.match(staleMarkup, /data-mapping-key="compromised_account_trap"[\s\S]*>Unavailable</);

  const emptyDefinition = createMappingPageDefinition(PAGE_KEY);
  const emptySnapshot = snapshot();
  const emptyStore = createControlStateStore();
  emptyStore.register(emptyDefinition);
  emptyStore.hydrate(PAGE_KEY, emptySnapshot, 'e'.repeat(64));
  const emptyMarkup = mappingPageMarkup({
    pageKey: PAGE_KEY,
    state: emptyStore.get(PAGE_KEY),
    snapshot: emptySnapshot,
  });
  assert.match(emptyMarkup, /data-mapping-key="compromised_account_trap"[\s\S]*>Not connected</);
});

test('arming requires explicit destructive acknowledgement before Save can proceed', async () => {
  const {
    createMappingPageDefinition,
    installMappingPageInteractions,
    mappingPageMarkup,
    requiresDestructiveMappingConfirmation,
  } = await mappingsModule();
  const currentSnapshot = snapshot();
  const definition = createMappingPageDefinition(PAGE_KEY);
  const store = pageStore(definition, currentSnapshot);
  store.updateDraft(PAGE_KEY, draft => { draft.compromised_account_trap = '101'; });

  assert.equal(
    requiresDestructiveMappingConfirmation(store.get(PAGE_KEY).persisted, store.get(PAGE_KEY).draft),
    true,
  );
  assert.equal(store.canSave(PAGE_KEY), false);
  let markup = mappingPageMarkup({ pageKey: PAGE_KEY, state: store.get(PAGE_KEY), snapshot: currentSnapshot });
  assert.match(markup, new RegExp(WARNING.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(markup, /data-mapping-destructive-confirm/);
  assert.match(markup, /data-mapping-save disabled/);

  const root = new FakeRoot();
  const remove = installMappingPageInteractions({
    root,
    pageKey: PAGE_KEY,
    store,
    snapshot: currentSnapshot,
    rerender() {},
  });
  try {
    root.emit('change', destructiveConfirmationTarget(true));
    assert.equal(store.canSave(PAGE_KEY), true);
    markup = mappingPageMarkup({ pageKey: PAGE_KEY, state: store.get(PAGE_KEY), snapshot: currentSnapshot });
    assert.doesNotMatch(markup, /data-mapping-save disabled/);
  } finally {
    remove();
  }
});

test('remapping resets acknowledgement when the selected trap channel changes', async () => {
  const { createMappingPageDefinition, installMappingPageInteractions } = await mappingsModule();
  const currentSnapshot = snapshot({ trapId: '101', trapExists: true });
  const definition = createMappingPageDefinition(PAGE_KEY);
  const store = pageStore(definition, currentSnapshot);
  const root = new FakeRoot();
  const remove = installMappingPageInteractions({
    root,
    pageKey: PAGE_KEY,
    store,
    snapshot: currentSnapshot,
    rerender() {},
  });

  try {
    root.emit('change', mappingTarget('compromised_account_trap', '102'));
    assert.equal(store.canSave(PAGE_KEY), false);
    root.emit('change', destructiveConfirmationTarget(true));
    assert.equal(store.canSave(PAGE_KEY), true);

    root.emit('change', mappingTarget('compromised_account_trap', '103'));
    assert.equal(store.canSave(PAGE_KEY), false);
  } finally {
    remove();
  }
});

test('clearing the trap is immediate and confirmation-free', async () => {
  const {
    createMappingPageDefinition,
    mappingPageMarkup,
    requiresDestructiveMappingConfirmation,
  } = await mappingsModule();
  const currentSnapshot = snapshot({ trapId: '101', trapExists: true });
  const definition = createMappingPageDefinition(PAGE_KEY);
  const store = pageStore(definition, currentSnapshot);
  store.updateDraft(PAGE_KEY, draft => { draft.compromised_account_trap = null; });

  assert.equal(
    requiresDestructiveMappingConfirmation(store.get(PAGE_KEY).persisted, store.get(PAGE_KEY).draft),
    false,
  );
  assert.equal(store.canSave(PAGE_KEY), true);
  const markup = mappingPageMarkup({ pageKey: PAGE_KEY, state: store.get(PAGE_KEY), snapshot: currentSnapshot });
  assert.doesNotMatch(markup, /data-mapping-destructive-confirm/);
  assert.doesNotMatch(markup, /data-mapping-save disabled/);
});

test('ordinary mapping edits never require trap acknowledgement', async () => {
  const {
    createMappingPageDefinition,
    mappingPageMarkup,
    requiresDestructiveMappingConfirmation,
  } = await mappingsModule();
  const currentSnapshot = snapshot();
  const definition = createMappingPageDefinition(PAGE_KEY);
  const store = pageStore(definition, currentSnapshot);
  store.updateDraft(PAGE_KEY, draft => { draft.moderation_log = '103'; });

  assert.equal(
    requiresDestructiveMappingConfirmation(store.get(PAGE_KEY).persisted, store.get(PAGE_KEY).draft),
    false,
  );
  assert.equal(store.canSave(PAGE_KEY), true);
  const markup = mappingPageMarkup({ pageKey: PAGE_KEY, state: store.get(PAGE_KEY), snapshot: currentSnapshot });
  assert.doesNotMatch(markup, /data-mapping-destructive-confirm/);
});

test('manual-only trap proposals are filtered from suggestion groups and apply payloads', async () => {
  const { mappingSuggestionApplyPayload, mappingSuggestionGroups } = await mappingsModule();
  const currentSnapshot = snapshot();
  currentSnapshot.mappings_review.proposed = [
    {
      key: 'compromised_account_trap',
      group: 'channels',
      kind: 'text',
      action: 'bind',
      canonical_name: 'account-safety',
      current: null,
      target: { id: '101', name: 'account-safety' },
      requires_confirmation: true,
    },
    {
      key: 'ticket_panel',
      group: 'channels',
      kind: 'text',
      action: 'bind',
      canonical_name: 'ticket',
      current: null,
      target: { id: '103', name: 'general' },
      requires_confirmation: false,
    },
  ];

  const groups = mappingSuggestionGroups(currentSnapshot);
  assert.deepEqual(groups.channels.map(item => item.key), ['ticket_panel']);

  const payload = mappingSuggestionApplyPayload(
    currentSnapshot,
    new Set(['compromised_account_trap']),
  );
  assert.deepEqual(payload.items.map(item => item.key), ['ticket_panel']);
  assert.deepEqual(payload.confirmed_keys, []);
});
