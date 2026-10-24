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

test('the save bar carries pending changes and server status instead of a global tray', async () => {
  const { saveBarStatusLabel, saveBarStatusMarkup } = await import('../docs-site/control-components.js');
  const dirty = saveBarStatusMarkup({ dirty: true, changeCount: 3, status: 'dirty' });
  assert.match(dirty, /data-save-bar-status/);
  assert.match(dirty, /data-save-bar-dot/);
  assert.match(dirty, /data-save-bar-message/);
  assert.match(dirty, />3 pending changes</);

  const clean = saveBarStatusMarkup({ dirty: false, changeCount: 0, status: 'clean' });
  assert.match(clean, />No pending changes</);

  const saving = saveBarStatusMarkup({ dirty: true, changeCount: 3, status: 'saving' });
  assert.match(saving, />Saving changes/);

  assert.equal(saveBarStatusLabel({ dirty: true, changeCount: 1 }), '1 pending change');
  assert.equal(saveBarStatusLabel({ dirty: true, changeCount: 2 }), '2 pending changes');
  assert.equal(saveBarStatusLabel({ dirty: false, changeCount: 0 }), 'No pending changes');
});

test('select and dropdown chevrons sit clear of the field border', () => {
  const controlCss = readFileSync(new URL('../docs-site/control.css', import.meta.url), 'utf8');
  const featuresCss = readFileSync(new URL('../docs-site/control-features.css', import.meta.url), 'utf8');
  assert.match(controlCss, /--select-chevron:\s*url\(/);
  assert.match(controlCss, /html\[data-theme=["']dark["']\][\s\S]*?--select-chevron:/);
  assert.match(
    featuresCss,
    /\.control-page select:not\(\[multiple\]\)\s*\{[^}]*appearance:\s*none;[^}]*padding-right:\s*38px;[^}]*background-position:\s*right 16px center;[^}]*background-size:\s*12px 12px;/s,
  );
  assert.match(
    featuresCss,
    /\.utility-emoji-combobox\s*>\s*summary\s*\{[^}]*padding:\s*0 16px 0 10px;/s,
  );
});

test('Control chevrons share one shape and size', () => {
  const controlCss = readFileSync(new URL('../docs-site/control.css', import.meta.url), 'utf8');
  const featuresCss = readFileSync(new URL('../docs-site/control-features.css', import.meta.url), 'utf8');
  const utilities = readFileSync(new URL('../docs-site/control-utilities.js', import.meta.url), 'utf8');
  assert.match(controlCss, /--chevron-down-mask:\s*url\(/);
  assert.match(controlCss, /--select-chevron:\s*url\([^;]*M2\.5%204\.5%206%208l3\.5-3\.5/);
  assert.match(controlCss, /--chevron-down-mask:\s*url\([^;]*M2\.5%204\.5%206%208l3\.5-3\.5/);
  assert.match(
    controlCss,
    /\.control-nav-domain > button::after\s*\{[^}]*width:\s*12px;[^}]*height:\s*12px;[^}]*mask:\s*var\(--chevron-down-mask\)[^;]*;[^}]*color:\s*var\(--text-tertiary\);/s,
  );
  assert.doesNotMatch(controlCss, /\.control-nav-domain > button::after\s*\{[^}]*opacity:\s*\.5/s);
  assert.match(
    featuresCss,
    /\.utility-emoji-chevron\s*\{[^}]*width:\s*12px;[^}]*height:\s*12px;[^}]*mask:\s*var\(--chevron-down-mask\)[^;]*;[^}]*color:\s*var\(--text-tertiary\);/s,
  );
  assert.doesNotMatch(utilities, />⌄</);
});

test('unauthenticated pages leave sign-in to the navbar', async () => {
  const { identityMarkup, pageMarkup } = await import('../docs-site/control-components.js');
  const page = pageMarkup({ label: 'Community', path: '/control/community', domain: 'community' }, { authenticated: false });
  assert.match(page, /Sign in with Discord from the navigation to load Control\./);
  assert.doesNotMatch(page, /\/api\/auth\/start/);
  assert.doesNotMatch(page, /Sign in with Discord<\/a>/);

  const identity = identityMarkup({ authenticated: false });
  assert.match(identity, /href="\/api\/auth\/start"/);
  assert.match(identity, /Sign in with Discord/);
});

test('Control shell has no global changes tray', () => {
  const html = readFileSync(new URL('../docs-site/control.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../docs-site/control.css', import.meta.url), 'utf8');
  assert.equal(html.includes('controlChangesTray'), false);
  assert.equal(css.includes('.control-changes-tray'), false);
  assert.equal(css.includes('control-tray-'), false);
});

test('Control state tracks the number of pending changes', () => {
  const store = createControlStateStore();
  const pageKey = '/control/test/pending';
  store.register({
    pageKey,
    selectPersisted: () => ({ a: 0, b: 0 }),
    cloneDraft: value => structuredClone(value),
    validateDraft: () => ({}),
    diffDraft: (persisted, draft) => ['a', 'b']
      .filter(key => persisted[key] !== draft[key])
      .map(key => ({ key })),
    buildSaveRequest: () => ({}),
  });
  store.hydrate(pageKey, {}, 'revision');
  assert.equal(store.get(pageKey).changeCount, 0);
  store.beginEdit(pageKey);
  store.updateDraft(pageKey, draft => { draft.a = 1; });
  assert.equal(store.get(pageKey).changeCount, 1);
  store.updateDraft(pageKey, draft => { draft.b = 2; });
  assert.equal(store.get(pageKey).changeCount, 2);
  store.discard(pageKey);
  assert.equal(store.get(pageKey).changeCount, 0);
});

test('shared feature header shows Edit settings alone in read mode and the feature toggle in edit mode', async () => {
  const { featureHeaderActionsMarkup } = await import('../docs-site/control-components.js');
  const read = featureHeaderActionsMarkup({
    label: 'Announcements', enabled: true, editing: false, editAttribute: 'data-content-edit', toggleAttribute: 'data-content-feature-toggle',
  });
  assert.equal(read.includes('type=\"checkbox\"'), false);
  assert.equal(read.includes('disabled'), false);
  assert.equal(read.includes('aria-label=\"Announcements enabled\"'), false);
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

test('Announcement builder renders the composer in the center and the preview in context', async () => {
  const { createContentPageDefinition } = await import('../docs-site/control-content.js');
  const pageKey = '/control/content/announcements';
  const definition = createContentPageDefinition(pageKey);
  const store = createControlStateStore();
  store.register(definition);
  store.hydrate(pageKey, baseSnapshot(), 'a'.repeat(64));
  const state = store.get(pageKey);
  const markup = definition.render({ state, snapshot: baseSnapshot() });
  for (const token of [
    'content-announcement-layout', 'data-announcement-clear', '>Clear all<', 'data-announcement-send',
    'data-announcement-destination', 'maxlength=\"2000\"', 'maxlength=\"256\"', 'maxlength=\"4096\"', 'maxlength=\"2048\"',
    'data-announcement-image', 'data-announcement-color-swatch', 'data-announcement-color-popover',
    'data-announcement-counter=\"message\"', '>2000<', 'data-announcement-counter=\"title\"', '>256<',
    'data-announcement-counter=\"body\"', '>4096<', 'data-announcement-counter=\"footer\"', '>2048<',
  ]) assert.equal(markup.includes(token), true, token);
  assert.equal(markup.includes('data-announcement-preview'), false);

  const context = definition.renderContext({ state, snapshot: baseSnapshot() });
  assert.equal(context.includes('data-announcement-preview'), true);
  assert.equal(context.includes('Send readiness'), true);
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
