import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

const MODULE_URL = new URL('../docs-site/control-mappings.js', import.meta.url);

async function mappingsModule() {
  assert.equal(existsSync(MODULE_URL), true, 'Wave 5 must provide control-mappings.js.');
  return await import(MODULE_URL.href);
}

test('suggested mapping review groups real channel, role, and category proposals', async () => {
  const { mappingSuggestionGroups } = await mappingsModule();
  const snapshot = {
    mappings_review: {
      plan_hash: 'a'.repeat(64),
      quiet: false,
      proposed: [
        {
          key: 'ticket_panel',
          group: 'channels',
          kind: 'text',
          action: 'bind',
          current: null,
          target: { id: '101', name: 'ticket' },
          requires_confirmation: false,
        },
        {
          key: 'builder_role',
          group: 'roles',
          kind: 'role',
          action: 'bind',
          current: null,
          target: { id: '201', name: 'Builder' },
          requires_confirmation: false,
        },
        {
          key: 'temp_voice_category',
          group: 'categories',
          kind: 'category',
          action: 'create',
          current: null,
          target: null,
          requires_confirmation: true,
        },
        {
          key: 'solved_tag',
          group: 'forum-tags',
          kind: 'forum_tag',
          action: 'create',
          current: null,
          target: null,
          requires_confirmation: true,
        },
      ],
    },
  };

  const groups = mappingSuggestionGroups(snapshot);
  assert.deepEqual(groups.channels.map(item => item.key), ['ticket_panel']);
  assert.deepEqual(groups.roles.map(item => item.key), ['builder_role']);
  assert.deepEqual(groups.categories.map(item => item.key), ['temp_voice_category']);
  assert.equal(Object.values(groups).flat().some(item => item.key === 'solved_tag'), false);
});
