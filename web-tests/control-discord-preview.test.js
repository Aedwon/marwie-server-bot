import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { announcementPreviewMarkup } from '../docs-site/control-content.js';

const featureCss = readFileSync(new URL('../docs-site/control-features.css', import.meta.url), 'utf8');

const announcementSnapshot = () => ({
  channels: [
    { id: '102', name: 'announcements', kind: 'text' },
    { id: '100', name: 'general', kind: 'text' },
  ],
  members: [{ id: '123', name: 'Ada' }],
});

const notificationSnapshot = () => ({
  bot: { top_role_position: 100 },
  notification_panel: {
    title: 'Notification roles',
    description: 'Choose the updates you want to receive.',
    buttons: [
      { role_id: '456', label: 'Builder updates', emoji: '<:grok:1234>', style: 'primary' },
      { role_id: '456', label: 'Mentor digest', emoji: '', style: 'secondary' },
      { role_id: '456', label: 'Close', emoji: '', style: 'danger' },
      { role_id: '456', label: 'Reopen', emoji: '', style: 'success' },
      { role_id: '456', label: 'Live', emoji: '', style: 'primary' },
      { role_id: '456', label: 'More', emoji: '', style: 'primary' },
    ],
  },
  resources: [{ key: 'role_panel', id: '999', name: 'roles', exists: true, kind: 'text' }],
  roles: [{ id: '456', name: 'Live Notifications', position: 20, managed: false }],
  emojis: [
    {
      id: '1234',
      name: 'grok',
      animated: false,
      available: true,
      url: 'https://cdn.discordapp.com/emojis/1234.webp',
    },
  ],
});

async function notificationPreviewMarkup() {
  const { createUtilitiesPageDefinition } = await import('../docs-site/control-utilities.js');
  const definition = createUtilitiesPageDefinition('/control/utilities/notification-roles');
  const snapshot = notificationSnapshot();
  const persisted = definition.selectPersisted(snapshot);
  const draft = definition.cloneDraft(persisted);
  return definition.render({
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
}

test('announcement preview reads as a Discord message with a colored embed', () => {
  const markup = announcementPreviewMarkup(announcementSnapshot(), {
    destinationId: '102',
    message: 'Hello <@123>',
    title: 'Announcement title',
    body: 'Line one\nLine two',
    footer: 'Footer text',
    color: 'FF0050',
    imageUrl: 'https://example.com/image.png',
  });

  for (const token of [
    'discord-preview-channel',
    'discord-preview-channel-icon',
    '>announcements<',
    'discord-preview-message',
    'discord-preview-avatar',
    'src="/rob-robin.jpg?v=1"',
    'discord-preview-author',
    'discord-bot-label',
    'discord-preview-timestamp',
    'discord-preview-content',
    'discord-mention',
    'discord-embed',
    'discord-embed-title',
    'discord-embed-description',
    'discord-embed-footer',
    'discord-preview-image',
    '--embed-color:#FF0050',
    'Announcement title',
    'Line one<br>Line two',
    'Footer text',
  ]) {
    assert.equal(markup.includes(token), true, token);
  }
});

test('notification panel preview reads as a Discord message with action rows', async () => {
  const markup = await notificationPreviewMarkup();

  for (const token of [
    'Preview',
    'Approximate Discord appearance. Preview buttons are disabled.',
    'discord-preview-channel',
    'discord-preview-channel-icon',
    '>roles<',
    'discord-preview-message',
    'discord-preview-avatar',
    'src="/rob-robin.jpg?v=1"',
    'discord-preview-author',
    'discord-bot-label',
    'discord-preview-timestamp',
    'discord-embed-title',
    'discord-embed-description',
    '--embed-color:#5865f2',
    'utility-discord-action-row',
    'utility-discord-button-primary',
    'utility-discord-button-secondary',
    'utility-discord-button-success',
    'utility-discord-button-danger',
    'data-notification-preview-button',
    'https://cdn.discordapp.com/emojis/1234.webp',
  ]) {
    assert.equal(markup.includes(token), true, token);
  }

  assert.equal((markup.match(/utility-discord-action-row/g) || []).length, 2);
});

test('Discord preview styles carry the message, embed, and button surfaces', () => {
  for (const token of [
    '.discord-preview-message',
    'display: flex;',
    'gap: 16px;',
    '.discord-preview-avatar',
    'width: 40px;',
    '.discord-preview-author',
    '.discord-preview-timestamp',
    '.discord-embed',
    'border-left: 4px solid var(--embed-color',
    'background: #2b2d31;',
    '.utility-discord-action-row',
    '.utility-discord-button',
    'min-height: 32px;',
    'border-radius: 3px;',
    '.utility-discord-button-primary',
    'background: #5865f2;',
    '.utility-discord-button-secondary',
    'background: #4e5058;',
    '.utility-discord-button-success',
    'background: #248046;',
    '.utility-discord-button-danger',
    'background: #da373c;',
  ]) {
    assert.equal(featureCss.includes(token), true, token);
  }
});
