import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { ACTIONS, validateActionPayload } from '../api/_lib/actions.js';
import { createControlStateStore } from '../docs-site/control-state.js';

const baseSnapshot = () => ({
  bot: { top_role_position: 10 },
  features: [{ name: 'announcements', enabled: true, config: {} }],
  resources: [
    { key: 'announcements', id: '102', name: 'announcements', exists: true, kind: 'text' },
    { key: 'moderation_log', id: '100', name: 'general', exists: true, kind: 'text' },
  ],
  channels: [
    { id: '100', name: 'general', kind: 'text', category_id: null, send_messages: true, embed_links: true },
    { id: '102', name: 'announcements', kind: 'text', category_id: null, send_messages: true, embed_links: true },
    { id: '103', name: 'locked', kind: 'text', category_id: null, send_messages: false, embed_links: true },
    { id: '104', name: 'voice', kind: 'voice', category_id: null, send_messages: true, embed_links: true },
  ],
  roles: [{ id: '456', name: 'Builder', position: 2, managed: false, mentionable: true }],
  members: [{ id: '123', name: 'Ada' }, { id: '124', name: 'Grace' }],
  mappings_review: { plan_hash: 'a'.repeat(64), quiet: true, proposed: [] },
});

test('global changes tray is one compact/expanded surface and only minimize collapses it', async () => {
  const { changesTrayMarkup, nextTrayExpandedState } = await import('../docs-site/control-tray.js');
  const dirtyPages = ['/control/community/reputation', '/control/content/feeds', '/control/community/quizzes'];
  const compact = changesTrayMarkup({ expanded: false, status: { message: 'Server state is current.', tone: 'good' }, dirtyPages });
  assert.equal(compact.includes('data-control-tray-expand'), true);
  assert.equal(compact.includes('3 pending changes'), true);
  assert.equal(compact.includes('Across 3 Control pages'), false);

  const expanded = changesTrayMarkup({ expanded: true, status: { message: 'Server state is current.', tone: 'good' }, dirtyPages });
  assert.equal(expanded.includes('data-control-tray-minimize'), true);
  assert.equal(expanded.includes('>Changes<'), true);
  assert.equal(expanded.includes('Server state is current'), true);
  assert.equal(expanded.includes('Community'), true);
  assert.equal(expanded.includes('Content'), true);
  assert.equal(expanded.includes('Save all changes'), true);
  assert.equal(expanded.toLowerCase().includes('unsaved-dot'), false);
  assert.equal(expanded.toLowerCase().includes('pending-badge'), false);

  assert.equal(nextTrayExpandedState(true, 'content'), true);
  assert.equal(nextTrayExpandedState(true, 'save-all'), true);
  assert.equal(nextTrayExpandedState(true, 'minimize'), false);
  assert.equal(nextTrayExpandedState(false, 'expand'), true);
});

test('Control shell mounts one floating tray instead of the old workspace status row', () => {
  const html = readFileSync(new URL('../docs-site/control.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../docs-site/control.css', import.meta.url), 'utf8');
  assert.equal(html.includes('controlGlobalStatus'), false);
  assert.equal(html.split('id=\"controlChangesTray\"').length - 1, 1);
  assert.equal(css.includes('.control-changes-tray'), true);
  assert.equal(css.includes('prefers-reduced-motion: reduce'), true);
  assert.equal(css.includes('cubic-bezier'), true);
});

test('shared feature header keeps feature state and Edit settings together without a Feature status label', async () => {
  const { featureHeaderActionsMarkup } = await import('../docs-site/control-components.js');
  const read = featureHeaderActionsMarkup({
    label: 'Announcements', enabled: true, editing: false, editAttribute: 'data-content-edit', toggleAttribute: 'data-content-feature-toggle',
  });
  assert.equal(read.includes('type=\"checkbox\"'), true);
  assert.equal(read.includes('disabled'), true);
  assert.equal(read.includes('aria-label=\"Announcements enabled\"'), true);
  assert.equal(read.includes('data-content-edit'), true);
  assert.equal(read.includes('>Edit settings<'), true);
  assert.equal(read.includes('Feature status'), false);

  const edit = featureHeaderActionsMarkup({
    label: 'Announcements', enabled: false, editing: true, editAttribute: 'data-content-edit', toggleAttribute: 'data-content-feature-toggle',
  });
  assert.equal(edit.includes('data-content-feature-toggle'), true);
  assert.equal(edit.includes(' disabled aria-label='), false);
  assert.equal(edit.includes('>Edit settings<'), false);
});

test('Mappings read view is a semantic Classic admin table with plain status text', async () => {
  const { createMappingPageDefinition, mappingPageMarkup } = await import('../docs-site/control-mappings.js');
  const pageKey = '/control/mappings/channels';
  const definition = createMappingPageDefinition(pageKey);
  const store = createControlStateStore();
  store.register(definition);
  store.hydrate(pageKey, baseSnapshot(), 'f'.repeat(64));
  const markup = mappingPageMarkup({ pageKey, state: store.get(pageKey), snapshot: baseSnapshot() });
  assert.equal(markup.includes('<table class=\"mapping-table'), true);
  assert.equal(markup.includes('>Resource</th>'), true);
  assert.equal(markup.includes('>Current</th>'), true);
  assert.equal(markup.includes('>Status</th>'), true);
  assert.equal(markup.includes('class=\"mapping-status-text\"'), true);
  assert.equal(markup.includes('>Connected</td>'), true);
  assert.equal(markup.includes('mapping-health'), false);
  assert.equal(markup.includes('status-pill'), false);
  assert.equal(markup.includes('status-badge'), false);
  assert.equal(markup.includes('status-dot'), false);
});

test('Announcement composer uses permitted destinations and preserves literal mention syntax', async () => {
  const { announcementDestinationOptions, buildAnnouncementAction, resolveAnnouncementMentions } = await import('../docs-site/control-content.js');
  const snapshot = baseSnapshot();
  assert.deepEqual(announcementDestinationOptions(snapshot).map(item => item.id), ['100', '102']);
  const raw = 'Hi <@123> <@!124> <@&456> in <#100> @everyone @here';
  const resolved = resolveAnnouncementMentions(snapshot, raw);
  assert.equal(resolved.message, raw);
  assert.deepEqual(resolved.mentions.user_ids, ['123', '124']);
  assert.deepEqual(resolved.mentions.role_ids, ['456']);
  assert.equal(resolved.mentions.everyone, true);
  assert.equal(resolved.mentions.here, true);

  const action = buildAnnouncementAction(snapshot, {
    channelId: '100', message: raw, title: '', body: '', footer: '', color: '5865F2', imageUrl: '', mentions: resolved.mentions,
  });
  assert.equal(action.payload.channel_id, '100');
  assert.equal(action.payload.message, raw);
  assert.equal(action.payload.body, '');
});

test('Announcement postability and embed creation follow the approved content rules', async () => {
  const { announcementHasEmbed, announcementHasPostableContent, clearAnnouncementComposer } = await import('../docs-site/control-content.js');
  assert.equal(announcementHasPostableContent({ message: 'Message only' }), true);
  assert.equal(announcementHasPostableContent({ title: 'Title only' }), true);
  assert.equal(announcementHasPostableContent({ body: 'Body only' }), true);
  assert.equal(announcementHasPostableContent({ footer: 'Footer only', color: 'FF0000', imageUrl: 'https://example.com/a.png' }), false);
  assert.equal(announcementHasEmbed({ message: 'Message only' }), false);
  assert.equal(announcementHasEmbed({ title: 'Title' }), true);
  assert.equal(announcementHasEmbed({ body: 'Body' }), true);
  const cleared = clearAnnouncementComposer({
    destinationId: '102', message: 'x', title: 'y', body: 'z', footer: 'f', color: 'FF0000', imageUrl: 'https://example.com/a.png',
  });
  assert.equal(cleared.destinationId, '102');
  assert.equal(cleared.message, '');
  assert.equal(cleared.title, '');
  assert.equal(cleared.body, '');
  assert.equal(cleared.footer, '');
  assert.equal(cleared.imageUrl, '');
  assert.equal(cleared.color, '5865F2');
});

test('Discord preview resolves supported literal mention tokens without changing composer text', async () => {
  const { announcementPreviewMarkup } = await import('../docs-site/control-content.js');
  const markup = announcementPreviewMarkup(baseSnapshot(), {
    destinationId: '100', message: '<@123> <@!124> <@&456> <#100> @everyone @here', title: '', body: '', footer: '', color: '5865F2', imageUrl: '',
  });
  for (const expected of ['@Ada', '@Grace', '@Builder', '#general', '@everyone', '@here']) assert.equal(markup.includes(expected), true);
});

test('Announcement builder renders split composer/preview, trailing counters, image field, clear, and top preview CTA', async () => {
  const { createContentPageDefinition } = await import('../docs-site/control-content.js');
  const pageKey = '/control/content/announcements';
  const definition = createContentPageDefinition(pageKey);
  const store = createControlStateStore();
  store.register(definition);
  store.hydrate(pageKey, baseSnapshot(), 'a'.repeat(64));
  const markup = definition.render({ state: store.get(pageKey), snapshot: baseSnapshot() });
  for (const token of [
    'content-announcement-layout', 'data-announcement-clear', '>Clear all<', 'data-announcement-preview', 'data-announcement-send',
    'data-announcement-destination', 'maxlength=\"2000\"', 'maxlength=\"256\"', 'maxlength=\"4096\"', 'maxlength=\"2048\"',
    'data-announcement-image', 'data-announcement-color-swatch', 'data-announcement-color-popover',
    'data-announcement-counter=\"message\"', '>2000<', 'data-announcement-counter=\"title\"', '>256<',
    'data-announcement-counter=\"body\"', '>4096<', 'data-announcement-counter=\"footer\"', '>2048<',
  ]) assert.equal(markup.includes(token), true, token);
  assert.equal(markup.indexOf('data-announcement-send') < markup.indexOf('data-announcement-preview'), true);
});

test('browser action validation accepts message-only announcements and validates embed limits/image URL', () => {
  const base = {
    channel_id: '100', message: 'Message only', title: '', body: '', footer: '', color: '5865F2', image_url: '',
    mentions: { everyone: false, here: false, role_ids: [], user_ids: [] },
  };
  const messageOnly = validateActionPayload(ACTIONS.SEND_ANNOUNCEMENT, base);
  assert.equal(messageOnly.body, '');
  assert.equal(messageOnly.image_url, '');
  const longBody = validateActionPayload(ACTIONS.SEND_ANNOUNCEMENT, { ...base, message: '', body: 'x'.repeat(4096) });
  assert.equal(longBody.body.length, 4096);
  assert.throws(() => validateActionPayload(ACTIONS.SEND_ANNOUNCEMENT, { ...base, message: '', body: 'x'.repeat(4097) }));
  assert.throws(() => validateActionPayload(ACTIONS.SEND_ANNOUNCEMENT, { ...base, message: '', title: 'x'.repeat(256), body: 'y'.repeat(4096), footer: 'z'.repeat(2048) }));
  assert.throws(() => validateActionPayload(ACTIONS.SEND_ANNOUNCEMENT, { ...base, image_url: 'javascript:alert(1)' }));
  assert.throws(() => validateActionPayload(ACTIONS.SEND_ANNOUNCEMENT, { ...base, message: '', footer: 'footer' }));
});
