import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAPPING_PAGE_CONFIGS,
  MAPPING_RESOURCE_DEFINITIONS,
  mappingOptionsForKey,
} from '../docs-site/control-mappings.js';

const EXPECTED_KEYS = [
  'anon_messages_panel',
  'anon_messages_submissions',
  'anon_messages_audit_log',
];

test('anonymous message destinations are independent channel mappings', () => {
  const channelKeys = MAPPING_PAGE_CONFIGS['/control/mappings/channels'].resourceKeys;

  for (const key of EXPECTED_KEYS) {
    assert.equal(channelKeys.includes(key), true, `${key} must be visible on Channels mappings`);
    assert.equal(MAPPING_RESOURCE_DEFINITIONS[key].group, 'channels');
    assert.equal(MAPPING_RESOURCE_DEFINITIONS[key].kind, 'text');
  }

  assert.equal(MAPPING_RESOURCE_DEFINITIONS.anon_messages_panel.label, 'Anonymous message panel');
  assert.equal(MAPPING_RESOURCE_DEFINITIONS.anon_messages_submissions.label, 'Anonymous submissions');
  assert.equal(MAPPING_RESOURCE_DEFINITIONS.anon_messages_audit_log.label, 'Anonymous audit log');
});

test('anonymous message mappings only offer text channels', () => {
  const snapshot = {
    bot: { top_role_position: 10 },
    channels: [
      { id: '100', name: 'anonymous-panel', kind: 'text' },
      { id: '101', name: 'anonymous-chat', kind: 'text' },
      { id: '200', name: 'Create Workspace', kind: 'voice' },
      { id: '300', name: 'showcase', kind: 'forum' },
    ],
    roles: [],
  };

  for (const key of EXPECTED_KEYS) {
    assert.deepEqual(
      mappingOptionsForKey(snapshot, key).map(item => item.id),
      ['101', '100'],
    );
  }
});
