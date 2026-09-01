import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeSnapshotChannelCapabilities } from '../api/_lib/snapshot-compat.js';
import { announcementDestinationOptions } from '../docs-site/control-content.js';

test('Administrator snapshots without per-channel capability fields keep text channels selectable', () => {
  const snapshot = normalizeSnapshotChannelCapabilities({
    bot: { permissions: { administrator: true } },
    channels: [
      { id: '10', name: 'general', kind: 'text' },
      { id: '11', name: 'voice', kind: 'voice' },
    ],
  });

  assert.deepEqual(announcementDestinationOptions(snapshot).map(channel => channel.id), ['10']);
  assert.equal(snapshot.channels[0].embed_links, true);
});

test('legacy snapshots without Administrator do not assume text-channel send permission', () => {
  const snapshot = normalizeSnapshotChannelCapabilities({
    bot: { permissions: { administrator: false } },
    channels: [{ id: '10', name: 'general', kind: 'text' }],
  });

  assert.deepEqual(announcementDestinationOptions(snapshot), []);
});

test('explicit per-channel capability remains authoritative when present', () => {
  const snapshot = normalizeSnapshotChannelCapabilities({
    bot: { permissions: { administrator: true } },
    channels: [
      { id: '10', name: 'allowed', kind: 'text', send_messages: true, embed_links: true },
      { id: '11', name: 'blocked', kind: 'text', send_messages: false, embed_links: false },
    ],
  });

  assert.deepEqual(announcementDestinationOptions(snapshot).map(channel => channel.id), ['10']);
  assert.equal(snapshot.channels[1].send_messages, false);
  assert.equal(snapshot.channels[1].embed_links, false);
});
