import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const UTILITY_PATHS = [
  '/control/utilities/ticket-configuration',
  '/control/utilities/notification-roles',
  '/control/utilities/anonymous-questions',
];

async function utilitiesModule() {
  return import('../docs-site/control-utilities.js');
}

test('Ticket configuration batches feature, disable, re-enable, and create changes', async () => {
  const { createUtilitiesPageDefinition } = await utilitiesModule();
  const definition = createUtilitiesPageDefinition('/control/utilities/ticket-configuration');
  const persisted = definition.selectPersisted({
    features: [{ name: 'tickets', enabled: true }],
    ticket_types: [
      { key: 'support', label: 'Support', description: 'Staff help', enabled: true },
      { key: 'report', label: 'Report', description: 'Private report', enabled: false },
    ],
    resources: [],
  });
  const draft = definition.cloneDraft(persisted);
  draft.enabled = false;
  draft.ticket_types[0].enabled = false;
  draft.ticket_types[1].enabled = true;
  draft.ticket_types.push({
    key: 'general',
    label: 'General',
    description: 'General support',
    enabled: true,
    isNew: true,
  });

  assert.deepEqual(definition.validateDraft(draft), {});
  assert.deepEqual(definition.diffDraft(persisted, draft), [
    { action_type: 'set_feature', payload: { feature: 'tickets', enabled: false } },
    { action_type: 'disable_ticket_type', payload: { key: 'support' } },
    {
      action_type: 'upsert_ticket_type',
      payload: { key: 'report', label: 'Report', description: 'Private report' },
    },
    {
      action_type: 'upsert_ticket_type',
      payload: { key: 'general', label: 'General', description: 'General support' },
    },
  ]);
});

test('Notification roles owns panel behavior but never the mapped destination', async () => {
  const { createUtilitiesPageDefinition } = await utilitiesModule();
  const definition = createUtilitiesPageDefinition('/control/utilities/notification-roles');
  const persisted = definition.selectPersisted({
    notification_panel: {
      channel_id: '999',
      message_id: '111',
      title: 'Notifications',
      description: 'Choose updates.',
      buttons: [
        { role_id: '456', label: 'Events', emoji: '', style: 'primary' },
      ],
    },
    resources: [{ key: 'role_panel', id: '999', name: 'roles', exists: true, kind: 'text' }],
    roles: [],
  });
  assert.equal('channel_id' in persisted, false);

  const draft = definition.cloneDraft(persisted);
  draft.title = 'Notification roles';
  assert.deepEqual(definition.validateDraft(draft), {});
  assert.deepEqual(definition.diffDraft(persisted, draft), [
    {
      action_type: 'save_notification_panel',
      payload: {
        title: 'Notification roles',
        description: 'Choose updates.',
        buttons: [
          { role_id: '456', label: 'Events', emoji: '', style: 'primary' },
        ],
      },
    },
  ]);
});

test('Notification roles renders server emoji choices and a Discord-style draft preview', async () => {
  const { createUtilitiesPageDefinition } = await utilitiesModule();
  const definition = createUtilitiesPageDefinition('/control/utilities/notification-roles');
  const snapshot = {
    bot: { top_role_position: 100 },
    notification_panel: {
      title: 'AI Updates',
      description: "Get tagged for when there's a major update from the model providers.",
      buttons: [
        { role_id: '456', label: 'Grok', emoji: '<:grok:1234>', style: 'primary' },
      ],
    },
    resources: [{ key: 'role_panel', id: '999', name: 'roles', exists: true, kind: 'text' }],
    roles: [{ id: '456', name: 'xAI (Grok)', position: 20, managed: false }],
    emojis: [
      {
        id: '1234',
        name: 'grok',
        animated: false,
        available: true,
        url: 'https://cdn.discordapp.com/emojis/1234.webp',
      },
      {
        id: '5678',
        name: 'party',
        animated: true,
        available: true,
        url: 'https://cdn.discordapp.com/emojis/5678.gif',
      },
    ],
  };
  const persisted = definition.selectPersisted(snapshot);
  const draft = definition.cloneDraft(persisted);
  draft.title = 'AI Updates preview';
  const markup = definition.render({
    state: {
      persisted,
      draft,
      mode: 'edit',
      status: 'clean',
      dirty: true,
      errors: {},
      saveError: null,
      revision: 'a'.repeat(64),
    },
    snapshot,
  });

  assert.match(markup, /data-notification-emoji-search/);
  assert.match(markup, /data-notification-emoji-option="&lt;:grok:1234&gt;"/);
  assert.match(markup, /data-notification-emoji-option="&lt;a:party:5678&gt;"/);
  assert.match(markup, /utility-notification-preview/);
  assert.match(markup, /AI Updates preview/);
  assert.match(markup, /https:\/\/cdn\.discordapp\.com\/emojis\/1234\.webp/);
  assert.match(markup, /data-notification-preview-button/);
  assert.match(markup, /data-notification-preview-button[^>]*disabled/);
});

test('Notification roles preserves a configured emoji that is no longer available', async () => {
  const { createUtilitiesPageDefinition } = await utilitiesModule();
  const definition = createUtilitiesPageDefinition('/control/utilities/notification-roles');
  const snapshot = {
    bot: { top_role_position: 100 },
    notification_panel: {
      title: 'Notifications',
      description: 'Choose updates.',
      buttons: [
        { role_id: '456', label: 'Events', emoji: '<:deleted:9999>', style: 'secondary' },
      ],
    },
    resources: [],
    roles: [{ id: '456', name: 'Events', position: 20, managed: false }],
    emojis: [],
  };
  const persisted = definition.selectPersisted(snapshot);
  const markup = definition.render({
    state: {
      persisted,
      draft: definition.cloneDraft(persisted),
      mode: 'edit',
      status: 'clean',
      dirty: false,
      errors: {},
      saveError: null,
      revision: 'a'.repeat(64),
    },
    snapshot,
  });

  assert.match(markup, /Current emoji unavailable/);
  assert.match(markup, /data-notification-emoji-option="&lt;:deleted:9999&gt;"/);
  assert.match(markup, /:deleted:/);
});

test('Notification role text input updates the preview without rebuilding the editor', async () => {
  const { createUtilitiesPageDefinition } = await utilitiesModule();
  const definition = createUtilitiesPageDefinition('/control/utilities/notification-roles');
  const listeners = new Map();
  const preview = { innerHTML: '' };
  const root = {
    addEventListener(name, listener) {
      listeners.set(name, listener);
    },
    removeEventListener() {},
    querySelector(selector) {
      return selector === '[data-notification-preview-body]' ? preview : null;
    },
  };
  const state = {
    draft: {
      title: 'Old title',
      description: 'Description',
      buttons: [{ role_id: '456', label: 'Events', emoji: '', style: 'primary' }],
    },
    dirty: false,
    status: 'clean',
  };
  const store = {
    updateDraft(_pageKey, mutate) {
      mutate(state.draft);
      state.dirty = true;
    },
    get() {
      return state;
    },
    canSave() {
      return true;
    },
  };
  let rerenders = 0;
  definition.install({
    root,
    store,
    snapshot: { emojis: [] },
    rerender() {
      rerenders += 1;
    },
  });

  listeners.get('input')({
    target: {
      dataset: { notificationPanelField: 'title' },
      value: 'New title',
      tagName: 'INPUT',
    },
  });

  assert.equal(state.draft.title, 'New title');
  assert.match(preview.innerHTML, /New title/);
  assert.equal(rerenders, 0);
});

test('Notification emoji search filters server choices without changing the draft', async () => {
  const { createUtilitiesPageDefinition } = await utilitiesModule();
  const definition = createUtilitiesPageDefinition('/control/utilities/notification-roles');
  const listeners = new Map();
  const option = ({ value, name, selected }) => ({
    hidden: false,
    textContent: name,
    dataset: {
      notificationEmojiOption: value,
      emojiName: name.toLowerCase(),
    },
    getAttribute(attribute) {
      return attribute === 'aria-selected' ? String(selected) : null;
    },
  });
  const options = [
    option({ value: '', name: 'None', selected: false }),
    option({ value: '<:grok:1234>', name: 'grok', selected: true }),
    option({ value: '<a:party:5678>', name: 'party', selected: false }),
  ];
  const picker = {
    querySelectorAll(selector) {
      return selector === '[data-notification-emoji-option]' ? options : [];
    },
  };
  const root = {
    addEventListener(name, listener) {
      listeners.set(name, listener);
    },
    removeEventListener() {},
    querySelector() {
      return null;
    },
  };
  const state = {
    draft: {
      title: 'Notifications',
      description: 'Choose updates.',
      buttons: [{ role_id: '456', label: 'Events', emoji: '<:grok:1234>', style: 'primary' }],
    },
    dirty: false,
    status: 'clean',
  };
  const store = {
    updateDraft(_pageKey, mutate) {
      mutate(state.draft);
      state.dirty = true;
    },
    get() {
      return state;
    },
    canSave() {
      return true;
    },
  };
  definition.install({ root, store, snapshot: { emojis: [] } });

  listeners.get('input')({
    target: {
      dataset: { notificationEmojiSearch: 'true' },
      value: 'grok',
      closest() {
        return picker;
      },
    },
  });

  assert.equal(options[0].hidden, false);
  assert.equal(options[1].hidden, false);
  assert.equal(options[2].hidden, true);
  assert.equal(state.dirty, false);
});

test('Anonymous Questions edits only its feature state and never renders submitter identity', async () => {
  const { createUtilitiesPageDefinition } = await utilitiesModule();
  const definition = createUtilitiesPageDefinition('/control/utilities/anonymous-questions');
  const snapshot = {
    features: [{ name: 'anonymous_questions', enabled: true }],
    resources: [{ key: 'anon_questions', id: '321', name: 'anonymous-questions', exists: true }],
    anonymous_question_submissions: [
      { id: 1, user_id: '9988776655', question: 'Private audit-only row' },
    ],
  };
  const persisted = definition.selectPersisted(snapshot);
  const draft = definition.cloneDraft(persisted);
  draft.enabled = false;
  assert.deepEqual(definition.diffDraft(persisted, draft), [
    {
      action_type: 'set_feature',
      payload: { feature: 'anonymous_questions', enabled: false },
    },
  ]);

  const markup = definition.render({
    state: {
      persisted,
      draft: persisted,
      mode: 'read',
      status: 'clean',
      dirty: false,
      errors: {},
      saveError: null,
    },
    snapshot,
  });
  assert.doesNotMatch(markup, /9988776655|Private audit-only row/);
});

test('Message logging has no Utilities route, mapping editor, or canonical page registration', () => {
  const mappings = readFileSync(new URL('../docs-site/control-mappings.js', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../docs-site/control-app.js', import.meta.url), 'utf8');

  for (const source of [mappings, app]) {
    assert.doesNotMatch(source, /utilities\/message(?:-|_)logging/i);
  }
  assert.doesNotMatch(mappings, /message_logs|message logging/i);
});
