import assert from 'node:assert/strict';
import test from 'node:test';

import { registeredControlPage } from '../docs-site/control-page-registry.js';
import { createControlStateStore } from '../docs-site/control-state.js';
import {
  legacyMountPlanForPath,
  legacySectionForPath,
} from '../docs-site/control-page-adapter.js';

const PAGE_KEYS = {
  feeds: '/control/content/feeds',
  announcements: '/control/content/announcements',
  live: '/control/content/live',
};

function snapshot() {
  return {
    features: [
      { name: 'ai_updates', enabled: true, config: {} },
      { name: 'announcements', enabled: true, config: {} },
      { name: 'live_announcements', enabled: true, config: {} },
    ],
    resources: [
      { key: 'ai_updates', id: '101', name: 'ai-updates', exists: true, kind: 'text' },
      { key: 'announcements', id: '102', name: 'announcements', exists: true, kind: 'text' },
      { key: 'live_announcements', id: '103', name: 'live', exists: true, kind: 'text' },
      { key: 'live_ping_role', id: '104', name: 'Live Notifications', exists: true, kind: 'role' },
    ],
    ai_sources: [
      {
        id: 1,
        name: 'OpenAI',
        url: 'https://example.com/openai.xml',
        category: 'AI',
        enabled: true,
        last_checked_at: '2026-08-28T12:00:00+00:00',
      },
      {
        id: 2,
        name: 'Research',
        url: 'https://example.com/research.xml',
        category: 'Research',
        enabled: false,
        last_checked_at: null,
      },
    ],
  };
}

async function contentModule() {
  return import('../docs-site/control-content.js');
}

test('Content routes retire only their transitional legacy adapter ownership', () => {
  for (const pageKey of Object.values(PAGE_KEYS)) {
    assert.equal(legacySectionForPath(pageKey), null);
    assert.equal(legacyMountPlanForPath(pageKey), null);
  }

  assert.equal(legacySectionForPath('/control/community/reputation'), 'reputation');
  assert.notEqual(legacyMountPlanForPath('/control/community/reputation'), null);
});

test('three Content routes register as canonical pages', async () => {
  const { registerContentPages } = await contentModule();

  registerContentPages();

  for (const pageKey of Object.values(PAGE_KEYS)) {
    assert.ok(registeredControlPage(pageKey), `${pageKey} must be registered`);
  }
});

test('Feeds keeps source edits local and emits one page-level save request', async () => {
  const { createContentPageDefinition } = await contentModule();
  const definition = createContentPageDefinition(PAGE_KEYS.feeds);
  const store = createControlStateStore();
  store.register(definition);
  store.hydrate(PAGE_KEYS.feeds, snapshot(), 'a'.repeat(64));
  store.beginEdit(PAGE_KEYS.feeds);

  store.updateDraft(PAGE_KEYS.feeds, draft => {
    draft.enabled = false;
    draft.sources[0].name = 'OpenAI News';
    draft.sources[1].enabled = true;
    draft.sources.push({
      id: null,
      localId: 'new-source',
      name: 'Platform',
      url: 'https://example.com/platform.xml',
      category: 'Platform',
      enabled: true,
      last_checked_at: null,
    });
  });

  const request = store.buildSaveRequest(PAGE_KEYS.feeds);
  assert.equal(request.page_key, PAGE_KEYS.feeds);
  assert.equal(request.base_revision, 'a'.repeat(64));
  assert.deepEqual(
    request.changes.map(change => change.action_type),
    ['set_feature', 'upsert_ai_source', 'upsert_ai_source', 'upsert_ai_source'],
  );
  assert.equal(request.changes[0].payload.feature, 'ai_updates');
  assert.equal(request.changes[1].payload.source_id, 1);
  assert.equal(request.changes[2].payload.source_id, 2, 're-enable uses the existing source');
  assert.equal(request.changes[3].payload.source_id, undefined);
});

test('Feeds validation preserves URL and source-field constraints', async () => {
  const { createContentPageDefinition } = await contentModule();
  const definition = createContentPageDefinition(PAGE_KEYS.feeds);
  const persisted = definition.selectPersisted(snapshot());
  const draft = definition.cloneDraft(persisted);

  draft.sources[0].url = 'ftp://example.com/feed';
  draft.sources[0].name = 'x'.repeat(101);
  draft.sources[0].category = 'y'.repeat(51);

  const errors = definition.validateDraft(draft);
  assert.ok(errors['source:1:url']);
  assert.ok(errors['source:1:name']);
  assert.ok(errors['source:1:category']);
});

test('Feeds has no Poll now action and does not edit the ai_updates mapping', async () => {
  const { createContentPageDefinition } = await contentModule();
  const definition = createContentPageDefinition(PAGE_KEYS.feeds);
  const store = createControlStateStore();
  store.register(definition);
  const state = store.hydrate(PAGE_KEYS.feeds, snapshot(), 'b'.repeat(64));

  const markup = definition.render({ pageKey: PAGE_KEYS.feeds, state, snapshot: snapshot() });
  assert.doesNotMatch(markup, /Poll now/i);
  assert.doesNotMatch(markup, /name=["']ai_updates["']/i);
  assert.match(markup, /Mappings/i);
  assert.match(markup, /Last checked/i);
});

test('Announcement and Live builders use current Mappings-owned resources only', async () => {
  const {
    buildAnnouncementAction,
    buildLiveAction,
  } = await contentModule();
  const state = snapshot();

  const announcement = buildAnnouncementAction(state, {
    channel_id: '999',
    message: '',
    title: 'Update',
    body: 'Hello',
    footer: '',
    color: '5865F2',
    mentions: {
      everyone: false,
      here: false,
      role_ids: [],
      user_ids: [],
    },
  });
  assert.equal(announcement.actionType, 'send_announcement');
  assert.equal(announcement.payload.channel_id, '102');

  const live = buildLiveAction(state, {
    channel_id: '999',
    ping_role_id: '999',
    topic: 'Building live',
    pingConfiguredRole: true,
  });
  assert.equal(live.actionType, 'post_live');
  assert.equal(live.payload.channel_id, '103');
  assert.equal(live.payload.ping_role_id, '104');
});

test('immediate publishing fields never become page-save draft material', async () => {
  const { createContentPageDefinition } = await contentModule();
  const state = snapshot();

  for (const pageKey of [PAGE_KEYS.announcements, PAGE_KEYS.live]) {
    const definition = createContentPageDefinition(pageKey);
    const persisted = definition.selectPersisted(state);
    const draft = definition.cloneDraft(persisted);
    assert.deepEqual(Object.keys(draft), ['enabled']);

    draft.enabled = false;
    const changes = definition.diffDraft(persisted, draft);
    assert.deepEqual(changes.map(change => change.action_type), ['set_feature']);
  }
});

test('consequence confirmation is limited to real mentions', async () => {
  const {
    buildAnnouncementAction,
    buildLiveAction,
    requiresContentConfirmation,
  } = await contentModule();
  const state = snapshot();

  const ordinary = buildAnnouncementAction(state, {
    message: '', title: '', body: 'Plain update', footer: '', color: '5865F2',
    mentions: { everyone: false, here: false, role_ids: [], user_ids: [] },
  });
  assert.equal(requiresContentConfirmation(ordinary), false);

  const everyone = buildAnnouncementAction(state, {
    message: '@everyone', title: '', body: 'Important', footer: '', color: '5865F2',
    mentions: { everyone: true, here: false, role_ids: [], user_ids: [] },
  });
  assert.equal(requiresContentConfirmation(everyone), true);

  const noPingLive = buildLiveAction(state, { topic: '', pingConfiguredRole: false });
  assert.equal(requiresContentConfirmation(noPingLive), false);

  const pingLive = buildLiveAction(state, { topic: '', pingConfiguredRole: true });
  assert.equal(requiresContentConfirmation(pingLive), true);
});
