import assert from 'node:assert/strict';
import test from 'node:test';

import { announcementDestinationOptions } from '../docs-site/control-content.js';

test('Administrator snapshots without per-channel capability fields keep text channels selectable', () => {
  const snapshot = {
    bot: { permissions: { administrator: true } },
    channels: [
      { id: '10', name: 'general', kind: 'text' },
      { id: '11', name: 'voice', kind: 'voice' },
    ],
  };

  assert.deepEqual(announcementDestinationOptions(snapshot).map(channel => channel.id), ['10']);
});

test('legacy snapshots without Administrator do not assume text-channel send permission', () => {
  const snapshot = {
    bot: { permissions: { administrator: false } },
    channels: [{ id: '10', name: 'general', kind: 'text' }],
  };

  assert.deepEqual(announcementDestinationOptions(snapshot), []);
});

test('explicit per-channel capability remains authoritative when present', () => {
  const snapshot = {
    bot: { permissions: { administrator: true } },
    channels: [
      { id: '10', name: 'allowed', kind: 'text', send_messages: true },
      { id: '11', name: 'blocked', kind: 'text', send_messages: false },
    ],
  };

  assert.deepEqual(announcementDestinationOptions(snapshot).map(channel => channel.id), ['10']);
});
