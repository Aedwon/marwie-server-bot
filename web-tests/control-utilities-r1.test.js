import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { legacyMountPlanForPath } from '../docs-site/control-page-adapter.js';

const UTILITY_PATHS = [
  '/control/utilities/ticket-configuration',
  '/control/utilities/notification-roles',
  '/control/utilities/anonymous-questions',
];

async function utilitiesModule() {
  return import('../docs-site/control-utilities.js');
}

test('Utilities routes are canonical registered pages instead of transitional adapters', () => {
  for (const path of UTILITY_PATHS) {
    assert.equal(legacyMountPlanForPath(path), null, `${path} must not use a legacy adapter`);
  }

  const app = readFileSync(new URL('../docs-site/control-app.js', import.meta.url), 'utf8');
  assert.match(app, /registerUtilitiesPages\(\)/);
  assert.match(app, /control-utilities\.css/);
});

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
  const adapter = readFileSync(new URL('../docs-site/control-page-adapter.js', import.meta.url), 'utf8');
  const mappings = readFileSync(new URL('../docs-site/control-mappings.js', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../docs-site/control-app.js', import.meta.url), 'utf8');

  for (const source of [adapter, mappings, app]) {
    assert.doesNotMatch(source, /utilities\/message(?:-|_)logging/i);
  }
  assert.doesNotMatch(mappings, /message_logs|message logging/i);
});
