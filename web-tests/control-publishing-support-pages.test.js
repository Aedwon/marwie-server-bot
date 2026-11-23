import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { controlState, renderRegisteredControlContext, renderRegisteredControlPage } from '../docs-site/control-page-registry.js';
import {
  buildAnnouncementAction,
  buildLiveAction,
  installContentPageInteractions,
  requiresContentConfirmation,
} from '../docs-site/control-content.js';
import { installUtilitiesPageInteractions } from '../docs-site/control-utilities.js';
import { isDisclosureOpen } from '../docs-site/control-components.js?v=25';
import {
  ANNOUNCEMENTS, ANONYMOUS, FEEDS, LIVE, MODERATION, NOTIFICATIONS, STAGE_2B_PAGES, TICKETS,
  hydrateStage2b, stage2bSaveRequests, stage2bSnapshot,
} from './fixtures/stage2b-save-scenarios.js';

const expectedRequests = JSON.parse(readFileSync(new URL('./fixtures/stage2b-save-requests.json', import.meta.url), 'utf8'));
const read = name => readFileSync(new URL(`../docs-site/${name}`, import.meta.url), 'utf8');

const MASTER_LABELS = {
  [FEEDS]: 'Check feeds',
  [ANNOUNCEMENTS]: 'Send announcements from Control',
  [LIVE]: 'Post live notices',
  [TICKETS]: 'Open tickets from the panel',
  [ANONYMOUS]: 'Accept anonymous questions',
  [MODERATION]: 'Log moderation actions',
};

function fakeRoot() {
  const listeners = new Map();
  return {
    addEventListener(name, fn) { listeners.set(name, fn); },
    removeEventListener(name) { listeners.delete(name); },
    emit(name, event) { return listeners.get(name)?.(event); },
    querySelector() { return null; },
  };
}

function target(matches, props = {}) {
  return {
    matches,
    closest(selector) {
      return selector.split(',').map(part => part.trim()).some(part => matches.includes(part)) ? this : null;
    },
    ...props,
  };
}

test('Stage 2b pages edit in place with no context, Details, Edit settings or chips', () => {
  const snapshot = hydrateStage2b();
  for (const pageKey of STAGE_2B_PAGES) {
    assert.equal(controlState.get(pageKey).mode, 'edit', pageKey);
    const markup = renderRegisteredControlPage(pageKey, { snapshot });
    assert.doesNotMatch(markup, /Edit settings|data-content-edit|data-utility-edit|data-workflow-edit|control-feature-header-actions/, pageKey);
    assert.doesNotMatch(markup, /control-state-chip|control-context-status|data-control-details|control-context-section|control-status-text/, pageKey);
    assert.doesNotMatch(markup, /utility-message|content-message|role="alert"/, `${pageKey} shows errors as row problems only`);
    assert.equal(renderRegisteredControlContext(pageKey, { snapshot }), '', pageKey);
    assert.match(markup, /control-save-bar/, pageKey);
    if (MASTER_LABELS[pageKey]) {
      assert.match(markup, new RegExp(`data-master-row[\\s\\S]*${MASTER_LABELS[pageKey]}|${MASTER_LABELS[pageKey]}[\\s\\S]*data-master-row`), pageKey);
      assert.match(markup, /data-master="on"/, pageKey);
    }
  }
  const notifications = renderRegisteredControlPage(NOTIFICATIONS, { snapshot });
  assert.doesNotMatch(notifications, /data-master-row|data-master=/);
});

test('Stage 2b save requests match the pre-change behavior for identical draft edits', () => {
  assert.deepEqual(stage2bSaveRequests(), expectedRequests);
});

test('Feeds, Tickets, Notification roles and Moderation keep one disclosure per item and the page lede', () => {
  const snapshot = hydrateStage2b();
  const feeds = renderRegisteredControlPage(FEEDS, { snapshot });
  assert.match(feeds, /Post new items with \/ai-source poll in Discord\./);
  assert.equal((feeds.match(/data-source-row=/g) || []).length, 2);
  assert.match(feeds, /<span class="control-question-status">example\.com<\/span>/);
  assert.match(feeds, /id="feed-source-1-enabled"/);
  assert.match(feeds, /<h2 id="feeds-resources-heading">Channels<\/h2>/);

  const tickets = renderRegisteredControlPage(TICKETS, { snapshot });
  assert.match(tickets, /control-mono">support</);
  assert.match(tickets, /Channels and category/);
  assert.match(tickets, /Add ticket type/);

  const notifications = renderRegisteredControlPage(NOTIFICATIONS, { snapshot });
  assert.match(notifications, /for="notification-title">Panel title</);
  assert.match(notifications, /for="notification-description">Panel description</);
  assert.match(notifications, /data-notification-emoji-search/);
  assert.match(notifications, /class="control-preview"/);

  const anonymous = renderRegisteredControlPage(ANONYMOUS, { snapshot });
  assert.match(anonymous, /Members submit questions without their name, and staff review each one before it is posted\./);

  const moderation = renderRegisteredControlPage(MODERATION, { snapshot });
  assert.match(moderation, /data-disclosure="moderation-guide"/);
  assert.match(moderation, />How moderation works</);
  assert.doesNotMatch(moderation, /Operating guide|control-section-heading/);
});

test('Announcement composer keeps its payload and offers the preview beside it at 1100px and up', () => {
  const snapshot = hydrateStage2b();
  const markup = renderRegisteredControlPage(ANNOUNCEMENTS, { snapshot });
  for (const token of ['id="announcement-destination"', 'id="announcement-title"', 'id="announcement-body"', 'More options', 'data-announcement-preview', 'Send announcement']) {
    assert.ok(markup.includes(token), token);
  }
  assert.ok(markup.indexOf('data-announcement-send') > markup.indexOf('More options'), 'Send sits at the bottom of the composer');
  const css = read('control-features.css');
  assert.match(css, /@container control-main \(min-width: 1100px\) \{\s*\.control-composer-layout/);
  assert.match(css, /\.control-composer \{[^}]*border-radius: 14px/);

  const action = buildAnnouncementAction(snapshot, {
    channelId: '222', message: '@everyone', title: ' T ', body: ' B ', footer: ' F ', color: '#abcdef', imageUrl: 'https://example.com/a.png',
    mentions: { everyone: true, role_ids: ['1', '1'] },
  });
  assert.deepEqual(action, {
    actionType: 'send_announcement',
    payload: {
      channel_id: '222', message: '@everyone', title: 'T', body: 'B', footer: 'F', color: 'ABCDEF', image_url: 'https://example.com/a.png',
      mentions: { everyone: true, here: false, role_ids: ['1'], user_ids: [] },
    },
  });
  assert.equal(requiresContentConfirmation(action), true);
  assert.throws(() => buildAnnouncementAction(snapshot, { channelId: '222' }), /Add a message, title, or body/);
});

test('Live composer keeps its payload, names the ping role and disables Post while Posts to cannot send', () => {
  const snapshot = hydrateStage2b();
  const markup = renderRegisteredControlPage(LIVE, { snapshot });
  assert.match(markup, /Posts to/);
  assert.match(markup, /Ping role/);
  assert.match(markup, /Ping @Live Notifications/);
  assert.match(markup, /id="live-topic"/);
  assert.match(markup, /data-live-send>Post live notice</);

  const action = buildLiveAction(snapshot, { topic: ' Build ', pingConfiguredRole: true });
  assert.deepEqual(action, { actionType: 'post_live', payload: { channel_id: '223', ping_role_id: '224', topic: 'Build' } });
  assert.equal(requiresContentConfirmation(action), true);
  assert.equal(requiresContentConfirmation(buildLiveAction(snapshot, {})), false);

  const blocked = stage2bSnapshot();
  blocked.channels.find(channel => channel.id === '223').send_messages = false;
  const blockedMarkup = renderRegisteredControlPage(LIVE, { snapshot: blocked });
  assert.match(blockedMarkup, /Rob-bot can&#39;t send messages there\./);
  assert.match(blockedMarkup, /data-live-send disabled>/);

  // A mapped channel that was deleted in Discord also blocks posting.
  const deleted = stage2bSnapshot();
  deleted.channels = deleted.channels.filter(channel => channel.id !== '223');
  assert.match(renderRegisteredControlPage(LIVE, { snapshot: deleted }), /data-live-send disabled>/);
});

test('Validation errors render as the problem line of their row', () => {
  const snapshot = hydrateStage2b();
  controlState.updateDraft(TICKETS, draft => { draft.ticket_types[0].label = ''; });
  const tickets = renderRegisteredControlPage(TICKETS, { snapshot });
  assert.match(tickets, /<p class="control-problem">[\s\S]*Label is required\./);
  assert.match(tickets, /data-ticket-row="0"[^>]*data-problem/);
  assert.match(tickets, /data-disclosure="ticket-type-0" data-open="true"/);
  controlState.discard(TICKETS);

  controlState.updateDraft(FEEDS, draft => { draft.sources[0].url = 'nope'; });
  const feeds = renderRegisteredControlPage(FEEDS, { snapshot });
  assert.match(feeds, /<p class="control-problem">[\s\S]*Source URL must be HTTP or HTTPS/);
  controlState.discard(FEEDS);

  controlState.updateDraft(NOTIFICATIONS, draft => { draft.buttons = []; });
  const notifications = renderRegisteredControlPage(NOTIFICATIONS, { snapshot });
  assert.match(notifications, /<p class="control-problem">[\s\S]*Add at least one notification role button\./);
  controlState.discard(NOTIFICATIONS);
});

test('Moderation keeps the destructive confirmation before the trap can be saved', () => {
  const snapshot = hydrateStage2b();
  const idle = renderRegisteredControlPage(MODERATION, { snapshot });
  assert.doesNotMatch(idle, /data-resource-confirm/);
  assert.match(idle, /Any human who sends a new message in this channel/);
  controlState.updateDraft(MODERATION, draft => { draft.resourceBindings.compromised_account_trap = '260'; });
  assert.equal(controlState.canSave(MODERATION), false);
  const pending = renderRegisteredControlPage(MODERATION, { snapshot });
  assert.match(pending, /data-resource-confirm="compromised_account_trap"/);
  assert.match(pending, /Confirm automatic compromised-account enforcement before saving\./);
  controlState.updateDraft(MODERATION, draft => { draft.resourceAcknowledgements.compromised_account_trap = true; });
  assert.equal(controlState.canSave(MODERATION), true);
  assert.match(renderRegisteredControlPage(MODERATION, { snapshot }), /data-resource-confirm="compromised_account_trap" checked/);
  controlState.discard(MODERATION);
});

test('Typed text reaches the draft on input and Add opens the new row', () => {
  const snapshot = hydrateStage2b();
  const root = fakeRoot();
  let rerenders = 0;
  const remove = installContentPageInteractions({ root, pageKey: FEEDS, store: controlState, snapshot, rerender: () => { rerenders += 1; } });
  root.emit('input', { target: target(['[data-source-field]'], { dataset: { sourceField: 'name', sourceKey: 'source-1' }, type: 'text', value: 'Typed' }) });
  assert.equal(controlState.get(FEEDS).draft.sources[0].name, 'Typed');
  assert.equal(rerenders, 1);
  root.emit('click', { target: target(['[data-source-add]']) });
  const added = controlState.get(FEEDS).draft.sources.at(-1);
  assert.equal(added.id, null);
  assert.equal(isDisclosureOpen(`feed-source-${added.localId}`), true);
  remove();
  controlState.discard(FEEDS);

  const utilitiesRoot = fakeRoot();
  const removeUtilities = installUtilitiesPageInteractions({ root: utilitiesRoot, pageKey: TICKETS, store: controlState, rerender: () => { rerenders += 1; } });
  utilitiesRoot.emit('click', { target: target(['[data-ticket-add]']) });
  const count = controlState.get(TICKETS).draft.ticket_types.length;
  assert.equal(controlState.get(TICKETS).draft.ticket_types.at(-1).isNew, true);
  assert.equal(isDisclosureOpen(`ticket-type-${count - 1}`), true);
  utilitiesRoot.emit('input', {
    target: target(['[data-ticket-field]'], {
      dataset: { ticketField: 'label' }, type: 'text', value: 'New label',
      closest(selector) { return selector === '[data-ticket-row]' ? { dataset: { ticketRow: String(count - 1) } } : null; },
    }),
  });
  assert.equal(controlState.get(TICKETS).draft.ticket_types.at(-1).label, 'New label');
  removeUtilities();
  controlState.discard(TICKETS);
});

test('Stage 2b modules carry new versions and the CSS section sits at the end', () => {
  const app = read('control-app.js');
  assert.match(app, /control-content\.js\?v=25/);
  assert.match(app, /control-utilities\.js\?v=25/);
  assert.match(app, /control-workflows\.js\?v=24/);
  const css = read('control-features.css');
  assert.match(css, /\/\* Stage 2b: publishing, support and safety pages \*\//);
  assert.ok(css.lastIndexOf('Stage 2b: publishing') > css.lastIndexOf('/* Page model:'));
});
