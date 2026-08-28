import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const PAGE_SAVE = readFileSync(new URL('../api/page-save.js', import.meta.url), 'utf8');
const ACTIVITY = readFileSync(new URL('../api/activity.js', import.meta.url), 'utf8');

test('page-save endpoint queues exactly one durable save_page action behind current browser safety checks', () => {
  assert.match(PAGE_SAVE, /const ACTION_TYPE = 'save_page'/);
  assert.equal((PAGE_SAVE.match(/INSERT INTO control_actions/g) || []).length, 1);
  assert.match(PAGE_SAVE, /updated_at >= CURRENT_TIMESTAMP - INTERVAL '3 minutes'/);
  assert.match(PAGE_SAVE, /created_at >= CURRENT_TIMESTAMP - INTERVAL '60 seconds'/);
  assert.match(PAGE_SAVE, /ON CONFLICT ON CONSTRAINT uq_control_actions_actor_idempotency DO NOTHING/);
  assert.match(PAGE_SAVE, /requireBrowserPermission\(oauthGuild, change\.action_type\)/);
  assert.match(PAGE_SAVE, /pageSavePayloadMatches\(existing\[0\]\.payload_json, payload\)/);
});

test('Activity endpoint is authorized, stable, bounded, and excludes internal refresh by default', () => {
  assert.match(ACTIVITY, /requireSession/);
  assert.match(ACTIVITY, /requireGuild\(session, guildId\)/);
  assert.match(ACTIVITY, /Math\.min\(50, Math\.max\(1,/);
  assert.match(ACTIVITY, /action_type <> 'refresh_snapshot'/);
  assert.match(ACTIVITY, /ORDER BY created_at DESC, id DESC/);
  assert.match(ACTIVITY, /encodeActivityCursor/);
  assert.doesNotMatch(ACTIVITY, /json\(res, 200, \{[^}]*payload_json/s);
});
