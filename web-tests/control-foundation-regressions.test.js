import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  identityMarkup,
  pageMarkup,
} from '../docs-site/control-components.js';
import {
  CONTROL_DESTINATIONS,
  resolveControlRoute,
} from '../docs-site/control-router.js';

const controlHtml = readFileSync(
  new URL('../docs-site/control.html', import.meta.url),
  'utf8',
);
const controlApp = readFileSync(
  new URL('../docs-site/control-app.js', import.meta.url),
  'utf8',
);

const controlLive = readFileSync(
  new URL('../docs-site/control-live.js', import.meta.url),
  'utf8',
);
const controlRefine = readFileSync(
  new URL('../docs-site/control-refine.js', import.meta.url),
  'utf8',
);

class FakeTarget {
  constructor({ dataset = {}, hidden = false } = {}) {
    this.dataset = dataset;
    this.hidden = hidden;
    this.disabled = false;
    this.focused = false;
    this.listeners = new Map();
    this.attributes = new Map();
  }

  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  removeEventListener(type, handler) {
    const handlers = this.listeners.get(type) || [];
    this.listeners.set(type, handlers.filter(item => item !== handler));
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  focus() {
    this.focused = true;
  }

  async emit(type, init = {}) {
    const event = {
      type,
      target: init.target ?? this,
      key: init.key,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      ...init,
    };

    for (const handler of this.listeners.get(type) || []) {
      await handler(event);
    }

    return event;
  }
}

test('routing tests execute the real canonical router', () => {
  const paths = CONTROL_DESTINATIONS.map(item => item.path);

  assert.equal(
    resolveControlRoute('/control/community/reputation').path,
    '/control/community/reputation',
  );
  assert.equal(
    resolveControlRoute('/control/content/feeds').path,
    '/control/content/feeds',
  );
  assert.equal(
    resolveControlRoute('/control/commands').path,
    '/control/commands',
  );
  assert.equal(
    resolveControlRoute('/control/activity').path,
    '/control/activity',
  );

  assert.equal(paths.some(path => /overview|build-help/.test(path)), false);
});

test('invalid child URLs use the domain first child, never remembered child', () => {
  assert.equal(
    resolveControlRoute(
      '/control/community/not-real',
      '/control/content/live',
      { community: '/control/community/quizzes' },
    ).path,
    '/control/community/reputation',
  );

  assert.equal(
    resolveControlRoute(
      '/control/content/not-real',
      '/control/community/quizzes',
      { content: '/control/content/live' },
    ).path,
    '/control/content/feeds',
  );

  assert.equal(
    resolveControlRoute(
      '/control/not-a-domain/not-real',
      '/control/content/live',
      { community: '/control/community/quizzes' },
    ).path,
    '/control/community/reputation',
  );

  const resolved = resolveControlRoute(
    '/control/community/not-real',
    null,
    { community: '/control/community/quizzes' },
  );
  assert.equal(resolveControlRoute(resolved.path).path, resolved.path);
});

test('canonical routes use a narrow internal live compatibility adapter', async () => {
  const adapter = await import('../docs-site/control-page-adapter.js');

  assert.equal(
    adapter.legacySectionForPath('/control/community/reputation'),
    'reputation',
  );
  assert.equal(
    adapter.legacySectionForPath('/control/community/quizzes'),
    'quizzes',
  );
  assert.equal(
    adapter.legacySectionForPath('/control/content/feeds'),
    'feeds',
  );
  assert.equal(
    adapter.legacySectionForPath('/control/content/announcements'),
    'publishing',
  );
  assert.equal(
    adapter.legacySectionForPath('/control/content/live'),
    'publishing',
  );
  assert.equal(
    adapter.legacySectionForPath('/control/utilities/ticket-configuration'),
    'tickets',
  );

  // Do not map broad legacy sections that would re-expose removed ownership.
  assert.equal(
    adapter.legacySectionForPath('/control/mappings/channels'),
    null,
  );
  assert.equal(
    adapter.legacySectionForPath('/control/workflows/moderation'),
    null,
  );
  assert.equal(adapter.legacySectionForPath('/control/commands'), null);
  assert.equal(adapter.legacySectionForPath('/control/activity'), null);
});

test('browser-style mounting covers two domains plus Commands and Activity', async () => {
  const { mountControlDestination } =
    await import('../docs-site/control-page-adapter.js');

  const reputation = { id: 'reputation', parentNode: null };
  const feeds = { id: 'feeds', parentNode: null };
  const returned = [];

  const legacyRoot = {
    querySelector(selector) {
      if (selector === '#reputation') return reputation;
      if (selector === '#feeds') return feeds;
      return null;
    },
    append(node) {
      node.parentNode = this;
      returned.push(node.id);
    },
  };
  reputation.parentNode = legacyRoot;
  feeds.parentNode = legacyRoot;

  const main = {
    currentNode: null,
    innerHTML: '',
    dataset: {},
    replaceChildren(...nodes) {
      this.currentNode = nodes[0] || null;
      this.innerHTML = '';
      if (this.currentNode) this.currentNode.parentNode = this;
    },
  };

  const fallback = destination =>
    `<section data-mounted="${destination.path}"><h1>${destination.label}</h1></section>`;

  mountControlDestination({
    main,
    destination: resolveControlRoute('/control/community/reputation'),
    legacyRoot,
    renderFallback: fallback,
  });
  assert.equal(main.currentNode, reputation);
  assert.equal(main.dataset.pageKey, '/control/community/reputation');

  mountControlDestination({
    main,
    destination: resolveControlRoute('/control/content/feeds'),
    legacyRoot,
    renderFallback: fallback,
  });
  assert.equal(main.currentNode, feeds);
  assert.ok(returned.includes('reputation'));
  assert.equal(main.dataset.pageKey, '/control/content/feeds');

  mountControlDestination({
    main,
    destination: resolveControlRoute('/control/commands'),
    legacyRoot,
    renderFallback: fallback,
  });
  assert.equal(main.currentNode, null);
  assert.match(main.innerHTML, /Commands/);
  assert.equal(main.dataset.pageKey, '/control/commands');

  mountControlDestination({
    main,
    destination: resolveControlRoute('/control/activity'),
    legacyRoot,
    renderFallback: fallback,
  });
  assert.equal(main.currentNode, null);
  assert.match(main.innerHTML, /Activity/);
  assert.equal(main.dataset.pageKey, '/control/activity');
});

test('signed-out state does not expose live compatibility editors', async () => {
  const { mountControlDestination } =
    await import('../docs-site/control-page-adapter.js');

  const reputation = { id: 'reputation' };
  const legacyRoot = {
    querySelector() {
      return reputation;
    },
    append() {},
  };
  const main = {
    currentNode: null,
    innerHTML: '',
    dataset: {},
    replaceChildren(...nodes) {
      this.currentNode = nodes[0] || null;
      this.innerHTML = '';
    },
  };

  mountControlDestination({
    main,
    destination: resolveControlRoute('/control/community/reputation'),
    legacyRoot,
    allowLegacy: false,
    renderFallback: destination =>
      `<section><h1>${destination.label}</h1><p>Sign in with Discord</p></section>`,
  });

  assert.equal(main.currentNode, null);
  assert.match(main.innerHTML, /Sign in with Discord/);
});

test('sidebar hierarchy is account, navigation, branding, then Appearance', () => {
  const asideStart = controlHtml.indexOf('<aside id="controlNavDrawer"');
  const asideEnd = controlHtml.indexOf('</aside>', asideStart);
  const identity = controlHtml.indexOf('id="controlIdentity"', asideStart);
  const navigation = controlHtml.indexOf('id="controlNavContent"', asideStart);
  const brand = controlHtml.indexOf('class="control-brand"', asideStart);
  const appearance = controlHtml.indexOf('class="control-appearance"', asideStart);

  assert.ok(asideStart >= 0);
  assert.ok(
    asideStart < identity
      && identity < navigation
      && navigation < brand
      && brand < appearance
      && appearance < asideEnd,
  );

  assert.doesNotMatch(
    controlHtml.slice(asideStart, asideEnd),
    /server-picker|liveServerPicker/,
  );
});

test('appearance defaults to Dark and resolves Dark, Light and System correctly', async () => {
  const {
    installThemeControls,
    resolveThemePreference,
  } = await import('../docs-site/control-theme.js');

  assert.deepEqual(
    resolveThemePreference(null, false),
    { preference: 'dark', theme: 'dark' },
  );
  assert.deepEqual(
    resolveThemePreference(null, true),
    { preference: 'dark', theme: 'dark' },
  );
  assert.deepEqual(
    resolveThemePreference('dark', false),
    { preference: 'dark', theme: 'dark' },
  );
  assert.deepEqual(
    resolveThemePreference('light', true),
    { preference: 'light', theme: 'light' },
  );
  assert.deepEqual(
    resolveThemePreference('system', false),
    { preference: 'system', theme: 'light' },
  );
  assert.deepEqual(
    resolveThemePreference('system', true),
    { preference: 'system', theme: 'dark' },
  );

  const root = { dataset: {} };
  const dark = new FakeTarget({ dataset: { themeChoice: 'dark' } });
  const light = new FakeTarget({ dataset: { themeChoice: 'light' } });
  const system = new FakeTarget({ dataset: { themeChoice: 'system' } });
  const buttons = [dark, light, system];
  const media = new FakeTarget();
  media.matches = false;

  const values = new Map();
  const storage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };

  const remove = installThemeControls({
    root,
    buttons,
    media,
    storage,
  });

  assert.equal(root.dataset.preference, 'dark');
  assert.equal(root.dataset.theme, 'dark');
  assert.equal(dark.getAttribute('aria-pressed'), 'true');

  await light.emit('click');
  assert.equal(storage.getItem('rob-doc-theme'), 'light');
  assert.equal(root.dataset.theme, 'light');
  assert.equal(light.getAttribute('aria-pressed'), 'true');

  await system.emit('click');
  assert.equal(root.dataset.preference, 'system');
  assert.equal(root.dataset.theme, 'light');

  media.matches = true;
  await media.emit('change');
  assert.equal(root.dataset.theme, 'dark');

  remove();
});

test('appearance controls are ordered Dark, Light, System', () => {
  const appearance = controlHtml.indexOf('class="control-appearance"');
  const end = controlHtml.indexOf('</div>', appearance);
  const block = controlHtml.slice(appearance, end);

  assert.ok(block.indexOf('data-theme-choice="dark"') >= 0);
  assert.ok(
    block.indexOf('data-theme-choice="dark"')
      < block.indexOf('data-theme-choice="light"'),
  );
  assert.ok(
    block.indexOf('data-theme-choice="light"')
      < block.indexOf('data-theme-choice="system"'),
  );

  assert.match(
    controlHtml,
    /<html[^>]*data-theme=["']dark["'][^>]*data-preference=["']dark["']/,
  );
  assert.match(
    controlHtml,
    /localStorage\.getItem\(['"]rob-doc-theme['"]\)\s*\|\|\s*['"]dark['"]/,
  );
});

test('authenticated account menu opens, closes with Escape and signs out', async () => {
  const markup = identityMarkup(
    {
      authenticated: true,
      user: {
        name: 'Admin',
        avatar_url: null,
      },
    },
    {
      id: '123',
      name: 'AI App Builders',
    },
  );

  assert.match(markup, /data-account-trigger/);
  assert.match(markup, /aria-haspopup=["']menu["']/);
  assert.match(markup, /data-account-menu/);
  assert.match(markup, /data-account-sign-out/);

  const { installAccountMenu } =
    await import('../docs-site/control-account.js');

  const trigger = new FakeTarget();
  const menu = new FakeTarget({ hidden: true });
  const signOut = new FakeTarget();
  const doc = new FakeTarget();

  const root = {
    ownerDocument: doc,
    querySelector(selector) {
      if (selector === '[data-account-trigger]') return trigger;
      if (selector === '[data-account-menu]') return menu;
      if (selector === '[data-account-sign-out]') return signOut;
      return null;
    },
    contains(target) {
      return [trigger, menu, signOut].includes(target);
    },
  };

  let signOutCount = 0;
  const remove = installAccountMenu(root, {
    onSignOut: async () => {
      signOutCount += 1;
    },
  });

  await trigger.emit('click');
  assert.equal(menu.hidden, false);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');

  await doc.emit('keydown', { key: 'Escape', target: doc });
  assert.equal(menu.hidden, true);
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(trigger.focused, true);

  await trigger.emit('click');
  await signOut.emit('click');
  assert.equal(signOutCount, 1);

  remove();
});

test('the new shell retains live compatibility internally with no legacy route', () => {
  assert.match(controlHtml, /id="controlLegacyHost"/);
  assert.doesNotMatch(controlHtml, /href=["']\/control\/legacy/i);
  assert.match(controlApp, /mountControlDestination/);
});

test('ordinary user-facing pages contain no Foundation or migration commentary', () => {
  for (const path of [
    '/control/analytics',
    '/control/workflows/events',
    '/control/activity',
  ]) {
    const destination = resolveControlRoute(path);
    const markup = pageMarkup(destination, {
      authenticated: true,
      state: {},
      snapshot: { fresh: true },
    });
    assert.doesNotMatch(
      markup,
      /Foundation|migration|intentionally deferred|final UI/i,
    );
  }
});


test('compatibility adapter preserves every still-live canonical capability', async () => {
  const adapter = await import('../docs-site/control-page-adapter.js');

  const expected = new Map([
    ['/control/community/reputation', {
      sections: ['features', 'reputation'],
      featureKeys: ['reputation'],
    }],
    ['/control/community/quizzes', {
      sections: ['features', 'quizzes'],
      featureKeys: ['quizzes'],
    }],
    ['/control/community/voice-coworking', {
      sections: ['features'],
      featureKeys: ['voice', 'coworking'],
    }],
    ['/control/community/showcase', {
      sections: ['features'],
      featureKeys: ['showcase'],
    }],
    ['/control/content/feeds', {
      sections: ['features', 'feeds'],
      featureKeys: ['ai_updates'],
    }],
    ['/control/content/announcements', {
      sections: ['features', 'publishing'],
      featureKeys: ['announcements'],
    }],
    ['/control/content/live', {
      sections: ['features', 'publishing'],
      featureKeys: ['live_announcements'],
    }],
    ['/control/utilities/ticket-configuration', {
      sections: ['features', 'tickets'],
      featureKeys: ['tickets'],
    }],
    ['/control/utilities/notification-roles', {
      sections: ['setup'],
      setupMode: 'notification-roles',
    }],
    ['/control/utilities/anonymous-questions', {
      sections: ['features'],
      featureKeys: ['anonymous_questions'],
    }],
    ['/control/analytics', {
      sections: ['features'],
      featureKeys: ['analytics'],
    }],
    ['/control/mappings/channels', {
      sections: ['setup'],
      setupMode: 'mappings',
      resourceKeys: [
        'moderation_log',
        'ticket_panel',
        'ticket_logs',
        'create_workspace_voice',
        'coworking_lounge',
        'announcements',
        'live_announcements',
        'role_panel',
        'ai_updates',
        'quiz_channel',
        'anon_questions',
        'analytics',
        'showcase_forum',
        'app_of_the_week',
        'collab_lfg',
      ],
    }],
    ['/control/mappings/roles', {
      sections: ['setup'],
      setupMode: 'mappings',
      resourceKeys: [
        'live_ping_role',
        'builder_role',
        'contributor_role',
        'mentor_role',
      ],
    }],
    ['/control/mappings/categories', {
      sections: ['setup'],
      setupMode: 'mappings',
      resourceKeys: [
        'ticket_category',
        'temp_voice_category',
      ],
    }],
  ]);

  for (const [path, wanted] of expected) {
    const plan = adapter.legacyMountPlanForPath(path);
    assert.ok(plan, `${path} must retain its transitional live capability`);
    assert.deepEqual(plan.sections, wanted.sections, `${path} section ownership`);
    assert.deepEqual(plan.featureKeys || [], wanted.featureKeys || [], `${path} feature ownership`);
    assert.deepEqual(plan.resourceKeys || [], wanted.resourceKeys || [], `${path} mapping ownership`);
    assert.equal(plan.setupMode || null, wanted.setupMode || null, `${path} setup mode`);
  }

  for (const path of [
    '/control/workflows/moderation',
    '/control/workflows/ticket-handling',
    '/control/workflows/events',
    '/control/commands',
    '/control/activity',
  ]) {
    assert.equal(
      adapter.legacyMountPlanForPath(path),
      null,
      `${path} must not inherit mutable legacy ownership`,
    );
  }
});

test('canonical compatibility runtime cannot restore a stale legacy guild', () => {
  assert.match(
    controlLive,
    /controlLegacyHost/,
    'legacy runtime must detect the canonical compatibility host',
  );
  assert.match(
    controlLive,
    /canonicalHost[\s\S]{0,500}session\.guilds\[0\]/,
    'canonical compatibility runtime must use the same first guild as the visible shell',
  );
  assert.match(
    controlLive,
    /controlGlobalStatus/,
    'legacy action feedback must be visible in the canonical shell',
  );
});

test('notification-role refinement is available before the live runtime boots', () => {
  const refineIndex = controlHtml.indexOf('/control-refine.js');
  const liveIndex = controlHtml.indexOf('/control-live.js');
  const staticEditor = controlHtml.includes('notification-panel-editor');

  assert.ok(
    staticEditor || (refineIndex >= 0 && refineIndex < liveIndex),
    'Notification roles must retain the existing live editor before control-live boots',
  );

  if (refineIndex >= 0) {
    assert.doesNotMatch(
      controlRefine,
      /control-core\.js/,
      'the refinement must not be blocked behind the missing control-core.js',
    );
  }
});
