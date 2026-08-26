import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACTIONS,
  normalizeActionType,
  requireBrowserPermission,
  validateActionPayload,
} from '../api/_lib/actions.js';
import { guildCanManage, guildIsAdministrator, HttpError } from '../api/_lib/control.js';

const MANAGE_GUILD = String(0x20n);
const ADMINISTRATOR = String(0x8n);


test('Discord OAuth permission bits preserve admin/manage semantics', () => {
  assert.equal(guildCanManage({ permissions: MANAGE_GUILD, owner: false }), true);
  assert.equal(guildIsAdministrator({ permissions: MANAGE_GUILD, owner: false }), false);
  assert.equal(guildIsAdministrator({ permissions: ADMINISTRATOR, owner: false }), true);
  assert.equal(guildCanManage({ permissions: '0', owner: true }), true);
});


test('Discord snowflakes remain strings beyond JavaScript safe integer range', () => {
  const snowflake = '1234567890123456789';
  const payload = validateActionPayload(ACTIONS.SET_RESOURCE, {
    key: 'announcements',
    discord_id: snowflake,
  });
  assert.equal(payload.discord_id, snowflake);
});


test('ticket administration cannot be weakened to Manage Server', () => {
  assert.throws(
    () => requireBrowserPermission({ permissions: MANAGE_GUILD, owner: false }, ACTIONS.UPSERT_TICKET_TYPE),
    (error) => error instanceof HttpError && error.status === 403,
  );
  assert.doesNotThrow(() =>
    requireBrowserPermission({ permissions: ADMINISTRATOR, owner: false }, ACTIONS.UPSERT_TICKET_TYPE),
  );
});


test('announcement mention targets are structured and retain exact snowflakes', () => {
  const role = '1234567890123456789';
  const user = '2234567890123456789';
  const payload = validateActionPayload(ACTIONS.SEND_ANNOUNCEMENT, {
    channel_id: '3234567890123456789',
    message: `<@&${role}> <@${user}>`,
    title: '',
    body: 'Deploying now.',
    footer: '',
    color: '5865F2',
    mentions: {
      everyone: false,
      here: false,
      role_ids: [role],
      user_ids: [user],
    },
  });
  assert.deepEqual(payload.mentions.role_ids, [role]);
  assert.deepEqual(payload.mentions.user_ids, [user]);
});


test('Live post keeps explicit destination and optional ping role', () => {
  const payload = validateActionPayload(ACTIONS.POST_LIVE, {
    channel_id: '3234567890123456789',
    ping_role_id: '1234567890123456789',
    topic: 'Building live',
  });
  assert.equal(payload.channel_id, '3234567890123456789');
  assert.equal(payload.ping_role_id, '1234567890123456789');

  const noPing = validateActionPayload(ACTIONS.POST_LIVE, {
    channel_id: null,
    ping_role_id: null,
    topic: '',
  });
  assert.equal(noPing.channel_id, null);
  assert.equal(noPing.ping_role_id, null);
});


test('unsupported action names fail closed', () => {
  assert.throws(() => normalizeActionType('delete_everything'), HttpError);
});
