import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { ACTIONS, requireBrowserPermission, validateActionPayload } from '../api/_lib/actions.js';
import {
  controlState,
  registeredControlPage,
} from '../docs-site/control-page-registry.js';

const CHANNEL_KEYS = [
  'moderation_log',
  'ticket_panel',
  'ticket_logs',
  'create_workspace_voice',
  'coworking_lounge',
  'announcements',
  'live_announcements',
  'role_panel',
  'ai_updates',
  'quiz_channel',
  'anon_questions',
  'analytics',
  'showcase_forum',
  'app_of_the_week',
  'collab_lfg',
];
const ROLE_KEYS = [
  'live_ping_role',
  'builder_role',
  'contributor_role',
  'mentor_role',
];
const CATEGORY_KEYS = ['ticket_category', 'temp_voice_category'];
const EXCLUDED_KEYS = ['message_log', 'bot_log', 'build_help_forum', 'solved_tag'];
const PAGE_KEYS = {
  channels: '/control/mappings/channels',
  roles: '/control/mappings/roles',
  categories: '/control/mappings/categories',
};
const MAPPINGS_MODULE_URL = new URL('../docs-site/control-mappings.js', import.meta.url);

async function mappingsModule() {
  assert.equal(
    existsSync(MAPPINGS_MODULE_URL),
    true,
    'Wave 5 must provide the canonical control-mappings module.',
  );
  return await import(MAPPINGS_MODULE_URL.href);
}

function baseSnapshot() {
  return {
    bot: { top_role_position: 10 },
    resources: [
      { key: 'moderation_log', id: '100', name: 'moderation-log', exists: true, kind: 'text' },
      { key: 'ticket_panel', id: null, name: null, exists: false, kind: null },
      { key: 'ticket_logs', id: '999', name: null, exists: false, kind: 'channel' },
      { key: 'announcements', id: '104', name: 'announcements', exists: true, kind: 'text' },
      { key: 'live_ping_role', id: '200', name: 'Live Notifications', exists: true, kind: 'role' },
      { key: 'ticket_category', id: '300', name: 'TICKETS', exists: true, kind: 'category' },
    ],
    channels: [
      { id: '100', name: 'moderation-log', kind: 'text', category_id: null },
      { id: '101', name: 'general', kind: 'text', category_id: null },
      { id: '102', name: 'Create Workspace', kind: 'voice', category_id: '300' },
      { id: '103', name: 'Coworking Lounge', kind: 'voice', category_id: '300' },
      { id: '104', name: 'announcements', kind: 'text', category_id: null },
      { id: '105', name: 'showcase', kind: 'forum', category_id: null },
      { id: '300', name: 'TICKETS', kind: 'category', category_id: null },
      { id: '301', name: 'WORKSPACES', kind: 'category', category_id: null },
    ],
    roles: [
      { id: '200', name: 'Live Notifications', position: 2, managed: false, mentionable: false },
      { id: '201', name: 'Builder', position: 3, managed: false, mentionable: false },
      { id: '202', name: 'Managed integration', position: 1, managed: true, mentionable: false },
      { id: '203', name: 'Above Rob-bot', position: 12, managed: false, mentionable: false },
    ],
    mappings_review: {
      plan_hash: 'a'.repeat(64),
      quiet: false,
      proposed: [
        {
          key: 'ticket_panel',
          group: 'channels',
          kind: 'text',
          action: 'bind',
          canonical_name: 'ticket',
          current: null,
          target: { id: '101', name: 'general' },
          requires_confirmation: false,
        },
        {
          key: 'showcase_forum',
          group: 'channels',
          kind: 'forum',
          action: 'create',
          canonical_name: 'showcase',
          current: null,
          target: null,
          requires_confirmation: true,
        },
        {
          key: 'message_log',
          group: 'channels',
          kind: 'text',
          action: 'bind',
          canonical_name: 'bot-logs',
          current: null,
          target: { id: '101', name: 'general' },
          requires_confirmation: false,
        },
      ],
    },
  };
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
    const event = {
      target,
      preventDefault() {},
    };
    for (const handler of this.listeners.get(type) || []) handler(event);
  }
}

function fakeTarget(dataset = {}, value = '') {
  return {
    dataset,
    value,
    closest(selector) {
      if (selector === '[data-mapping-edit]' && 'mappingEdit' in dataset) return this;
      if (selector === '[data-mapping-save]' && 'mappingSave' in dataset) return this;
      if (selector === '[data-mapping-discard]' && 'mappingDiscard' in dataset) return this;
      if (selector === '[data-mapping-key]' && 'mappingKey' in dataset) return this;
      return null;
    },
  };
}

test('canonical Mappings page definitions own exactly the approved keys', async () => {
  const { MAPPING_PAGE_CONFIGS, MAPPING_RESOURCE_DEFINITIONS } = await mappingsModule();

  assert.deepEqual(MAPPING_PAGE_CONFIGS[PAGE_KEYS.channels].resourceKeys, CHANNEL_KEYS);
  assert.deepEqual(MAPPING_PAGE_CONFIGS[PAGE_KEYS.roles].resourceKeys, ROLE_KEYS);
  assert.deepEqual(MAPPING_PAGE_CONFIGS[PAGE_KEYS.categories].resourceKeys, CATEGORY_KEYS);
  assert.deepEqual(Object.keys(MAPPING_PAGE_CONFIGS).sort(), Object.values(PAGE_KEYS).sort());

  for (const key of EXCLUDED_KEYS) assert.equal(MAPPING_RESOURCE_DEFINITIONS[key], undefined);
  assert.equal(Object.values(MAPPING_PAGE_CONFIGS).some(page => page.group === 'forum-tags'), false);
});

test('Mappings expected Discord kinds distinguish text, voice, forum, category, and role', async () => {
  const { MAPPING_RESOURCE_DEFINITIONS } = await mappingsModule();

  assert.equal(MAPPING_RESOURCE_DEFINITIONS.moderation_log.kind, 'text');
  assert.equal(MAPPING_RESOURCE_DEFINITIONS.create_workspace_voice.kind, 'voice');
  assert.equal(MAPPING_RESOURCE_DEFINITIONS.coworking_lounge.kind, 'voice');
  assert.equal(MAPPING_RESOURCE_DEFINITIONS.showcase_forum.kind, 'forum');
  assert.equal(MAPPING_RESOURCE_DEFINITIONS.ticket_category.kind, 'category');
  assert.equal(MAPPING_RESOURCE_DEFINITIONS.live_ping_role.kind, 'role');
});

test('mapping options are filtered to the expected Discord kind and safe role choices', async () => {
  const { mappingOptionsForKey } = await mappingsModule();
  const snapshot = baseSnapshot();

  assert.deepEqual(mappingOptionsForKey(snapshot, 'moderation_log').map(item => item.id), ['104', '101', '100']);
  assert.deepEqual(mappingOptionsForKey(snapshot, 'create_workspace_voice').map(item => item.id), ['103', '102']);
  assert.deepEqual(mappingOptionsForKey(snapshot, 'showcase_forum').map(item => item.id), ['105']);
  assert.deepEqual(mappingOptionsForKey(snapshot, 'ticket_category').map(item => item.id), ['300', '301']);
  assert.deepEqual(mappingOptionsForKey(snapshot, 'builder_role').map(item => item.id), ['201', '200']);
  assert.equal(mappingOptionsForKey(snapshot, 'builder_role').some(item => item.managed), false);
  assert.equal(mappingOptionsForKey(snapshot, 'builder_role').some(item => item.id === '203'), false);
});

test('registered Mappings pages use the shared Foundation state contract', async () => {
  const { registerMappingPages } = await mappingsModule();
  registerMappingPages();

  for (const pageKey of Object.values(PAGE_KEYS)) {
    const definition = registeredControlPage(pageKey);
    assert.ok(definition);
    assert.equal(typeof definition.selectPersisted, 'function');
    assert.equal(typeof definition.cloneDraft, 'function');
    assert.equal(typeof definition.validateDraft, 'function');
    assert.equal(typeof definition.diffDraft, 'function');
    assert.equal(typeof definition.render, 'function');
  }
});

test('multi-row edits create one deterministic page-save batch with set, clear, and no unchanged operations', async () => {
  const { createMappingPageDefinition } = await mappingsModule();
  const pageKey = PAGE_KEYS.channels;
  const definition = createMappingPageDefinition(pageKey);
  const store = (await import('../docs-site/control-state.js')).createControlStateStore();
  store.register(definition);
  store.hydrate(pageKey, baseSnapshot(), 'b'.repeat(64));
  store.beginEdit(pageKey);
  store.updateDraft(pageKey, draft => {
    draft.moderation_log = '101';
    draft.ticket_panel = '104';
    draft.announcements = null;
  });

  assert.deepEqual(store.buildSaveRequest(pageKey), {
    page_key: pageKey,
    base_revision: 'b'.repeat(64),
    changes: [
      { action_type: 'set_resource', payload: { key: 'moderation_log', discord_id: '101' } },
      { action_type: 'set_resource', payload: { key: 'ticket_panel', discord_id: '104' } },
      { action_type: 'clear_resource', payload: { key: 'announcements' } },
    ],
  });
});

test('stale persisted mappings are unhealthy but do not block unrelated valid edits', async () => {
  const { createMappingPageDefinition } = await mappingsModule();
  const pageKey = PAGE_KEYS.channels;
  const definition = createMappingPageDefinition(pageKey);
  const store = (await import('../docs-site/control-state.js')).createControlStateStore();
  store.register(definition);
  store.hydrate(pageKey, baseSnapshot(), 'c'.repeat(64));
  store.beginEdit(pageKey);

  assert.equal(store.get(pageKey).persisted.ticket_logs.exists, false);
  assert.deepEqual(store.get(pageKey).errors, {});
  store.updateDraft(pageKey, draft => { draft.ticket_panel = '101'; });
  assert.deepEqual(store.get(pageKey).errors, {});
  assert.equal(store.canSave(pageKey), true);
});

test('a newly selected option that is not a current compatible Discord resource is rejected locally', async () => {
  const { createMappingPageDefinition } = await mappingsModule();
  const pageKey = PAGE_KEYS.channels;
  const definition = createMappingPageDefinition(pageKey);
  const store = (await import('../docs-site/control-state.js')).createControlStateStore();
  store.register(definition);
  store.hydrate(pageKey, baseSnapshot(), 'd'.repeat(64));
  store.beginEdit(pageKey);
  store.updateDraft(pageKey, draft => { draft.moderation_log = '102'; });

  assert.match(store.get(pageKey).errors.moderation_log, /text channel/i);
  assert.equal(store.canSave(pageKey), false);
});

test('Discard restores the authoritative persisted mapping draft', async () => {
  const { createMappingPageDefinition } = await mappingsModule();
  const pageKey = PAGE_KEYS.channels;
  const definition = createMappingPageDefinition(pageKey);
  const store = (await import('../docs-site/control-state.js')).createControlStateStore();
  store.register(definition);
  store.hydrate(pageKey, baseSnapshot(), 'e'.repeat(64));
  store.beginEdit(pageKey);
  store.updateDraft(pageKey, draft => { draft.moderation_log = '101'; });
  store.discard(pageKey);

  assert.equal(store.get(pageKey).draft.moderation_log, '100');
  assert.equal(store.get(pageKey).dirty, false);
});

test('mapping page markup uses read then edit state, visible health text, labels, and row associations', async () => {
  const { createMappingPageDefinition, mappingPageMarkup } = await mappingsModule();
  const pageKey = PAGE_KEYS.channels;
  const definition = createMappingPageDefinition(pageKey);
  const store = (await import('../docs-site/control-state.js')).createControlStateStore();
  store.register(definition);
  store.hydrate(pageKey, baseSnapshot(), 'f'.repeat(64));

  const readMarkup = mappingPageMarkup({ pageKey, state: store.get(pageKey), snapshot: baseSnapshot() });
  assert.match(readMarkup, /<h1>Channels<\/h1>/);
  assert.match(readMarkup, />Edit settings</);
  assert.match(readMarkup, />Connected</);
  assert.match(readMarkup, />Not connected</);
  assert.match(readMarkup, />Unavailable</);
  assert.match(readMarkup, /data-mapping-key="ticket_logs"/);

  store.beginEdit(pageKey);
  const editMarkup = mappingPageMarkup({ pageKey, state: store.get(pageKey), snapshot: baseSnapshot() });
  assert.match(editMarkup, /<label[^>]+for="mapping-moderation_log"/);
  assert.match(editMarkup, /id="mapping-moderation_log"/);
  assert.match(editMarkup, />Save changes</);
  assert.match(editMarkup, />Discard</);
  assert.match(editMarkup, /Unavailable current mapping/);
  assert.match(editMarkup, /disabled[^>]*>Unavailable current mapping/);
});

test('field changes mutate local draft without saving or making a network request', async () => {
  const { createMappingPageDefinition, installMappingPageInteractions } = await mappingsModule();
  const pageKey = PAGE_KEYS.channels;
  const definition = createMappingPageDefinition(pageKey);
  const store = (await import('../docs-site/control-state.js')).createControlStateStore();
  store.register(definition);
  store.hydrate(pageKey, baseSnapshot(), '1'.repeat(64));
  store.beginEdit(pageKey);

  const root = new FakeRoot();
  let saveCalls = 0;
  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    fetchCalls += 1;
    throw new Error('unexpected network request');
  };

  const remove = installMappingPageInteractions({
    root,
    pageKey,
    store,
    onSave: () => { saveCalls += 1; },
    rerender() {},
  });
  try {
    root.emit('change', fakeTarget({ mappingKey: 'moderation_log' }, '101'));
    assert.equal(store.get(pageKey).draft.moderation_log, '101');
    assert.equal(store.get(pageKey).dirty, true);
    assert.equal(saveCalls, 0);
    assert.equal(fetchCalls, 0);
  } finally {
    remove();
    globalThis.fetch = originalFetch;
  }
});

test('the page-level Save control emits exactly one logical save request', async () => {
  const { createMappingPageDefinition, installMappingPageInteractions } = await mappingsModule();
  const pageKey = PAGE_KEYS.channels;
  const definition = createMappingPageDefinition(pageKey);
  const store = (await import('../docs-site/control-state.js')).createControlStateStore();
  store.register(definition);
  store.hydrate(pageKey, baseSnapshot(), '2'.repeat(64));
  store.beginEdit(pageKey);
  store.updateDraft(pageKey, draft => {
    draft.moderation_log = '101';
    draft.ticket_panel = '104';
  });

  const root = new FakeRoot();
  const requests = [];
  const remove = installMappingPageInteractions({
    root,
    pageKey,
    store,
    onSave: (key, request) => requests.push([key, request]),
    rerender() {},
  });
  try {
    root.emit('click', fakeTarget({ mappingSave: '' }));
    assert.equal(requests.length, 1);
    assert.equal(requests[0][0], pageKey);
    assert.equal(requests[0][1].changes.length, 2);
  } finally {
    remove();
  }
});

test('suggested mappings are grouped only into Channels, Roles, and Categories and exclude prohibited resources', async () => {
  const { mappingSuggestionGroups } = await mappingsModule();
  const groups = mappingSuggestionGroups(baseSnapshot());

  assert.deepEqual(Object.keys(groups).sort(), ['categories', 'channels', 'roles']);
  assert.deepEqual(groups.channels.map(item => item.key), ['ticket_panel', 'showcase_forum']);
  assert.deepEqual(groups.roles, []);
  assert.deepEqual(groups.categories, []);
  for (const key of EXCLUDED_KEYS) {
    assert.equal(Object.values(groups).flat().some(item => item.key === key), false);
  }
});

test('healthy mappings make Review suggested mappings visually quiet', async () => {
  const { createMappingPageDefinition, mappingPageMarkup } = await mappingsModule();
  const snapshot = baseSnapshot();
  snapshot.mappings_review = { plan_hash: '3'.repeat(64), quiet: true, proposed: [] };
  const pageKey = PAGE_KEYS.channels;
  const definition = createMappingPageDefinition(pageKey);
  const store = (await import('../docs-site/control-state.js')).createControlStateStore();
  store.register(definition);
  store.hydrate(pageKey, snapshot, '4'.repeat(64));

  const markup = mappingPageMarkup({ pageKey, state: store.get(pageKey), snapshot });
  assert.match(markup, /Review suggested mappings/);
  assert.match(markup, /data-suggestions-quiet="true"/);
});

test('review payload preserves exact approved item scope and only explicit consequence confirmations', async () => {
  const { mappingSuggestionApplyPayload } = await mappingsModule();
  const payload = mappingSuggestionApplyPayload(baseSnapshot(), new Set(['showcase_forum']));

  assert.equal(payload.plan_hash, 'a'.repeat(64));
  assert.deepEqual(payload.items, [
    { key: 'ticket_panel', action: 'bind', target_id: '101' },
    { key: 'showcase_forum', action: 'create', target_id: null },
  ]);
  assert.deepEqual(payload.confirmed_keys, ['showcase_forum']);
});

test('routine bind and stale repair need review only while create and healthy replacement need confirmation', async () => {
  const { mappingSuggestionGroups } = await mappingsModule();
  const snapshot = baseSnapshot();
  snapshot.mappings_review.proposed.push(
    {
      key: 'announcements',
      group: 'channels',
      kind: 'text',
      action: 'remap',
      canonical_name: 'announcements',
      current: { id: '104', name: 'announcements' },
      target: { id: '101', name: 'general' },
      requires_confirmation: true,
    },
  );
  snapshot.mappings_review.proposed.push(
    {
      key: 'ticket_logs',
      group: 'channels',
      kind: 'text',
      action: 'bind',
      canonical_name: 'ticket-logs',
      current: null,
      target: { id: '101', name: 'general' },
      requires_confirmation: false,
    },
  );

  const byKey = Object.fromEntries(mappingSuggestionGroups(snapshot).channels.map(item => [item.key, item]));
  assert.equal(byKey.ticket_panel.requires_confirmation, false);
  assert.equal(byKey.ticket_logs.requires_confirmation, false);
  assert.equal(byKey.showcase_forum.requires_confirmation, true);
  assert.equal(byKey.announcements.requires_confirmation, true);
});

test('browser action contract validates scoped reviewed Mappings apply and requires Administrator', () => {
  assert.equal(ACTIONS.APPLY_MAPPING_SUGGESTIONS, 'apply_mapping_suggestions');
  const payload = validateActionPayload(ACTIONS.APPLY_MAPPING_SUGGESTIONS, {
    plan_hash: '5'.repeat(64),
    items: [
      { key: 'ticket_panel', action: 'bind', target_id: '1234567890123456789' },
      { key: 'showcase_forum', action: 'create', target_id: null },
    ],
    confirmed_keys: ['showcase_forum'],
  });
  assert.equal(payload.items[0].target_id, '1234567890123456789');
  assert.throws(
    () => requireBrowserPermission({ permissions: String(0x20n), owner: false }, ACTIONS.APPLY_MAPPING_SUGGESTIONS),
    /Administrator/,
  );
  assert.doesNotThrow(() =>
    requireBrowserPermission({ permissions: String(0x8n), owner: false }, ACTIONS.APPLY_MAPPING_SUGGESTIONS),
  );
});

test('browser scoped apply rejects unreviewed or disallowed Mappings resources', () => {
  assert.equal(ACTIONS.APPLY_MAPPING_SUGGESTIONS, 'apply_mapping_suggestions');
  assert.throws(() => validateActionPayload(ACTIONS.APPLY_MAPPING_SUGGESTIONS, {
    plan_hash: '6'.repeat(64),
    items: [{ key: 'message_log', action: 'bind', target_id: '1234567890123456789' }],
    confirmed_keys: [],
  }));
});

test('the Control app includes the registered canonical-page render boundary', async () => {
  const source = readFileSync(new URL('../docs-site/control-app.js', import.meta.url), 'utf8');
  assert.match(source, /registerMappingPages\(/);
  assert.match(source, /renderRegisteredControlPage\(/);
  assert.match(source, /installRegisteredControlPage\(/);
});
