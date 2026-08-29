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
