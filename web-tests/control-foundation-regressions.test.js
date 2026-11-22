import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { pageMarkup } from '../docs-site/control-components.js';
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
const controlCss = readFileSync(
  new URL('../docs-site/control.css', import.meta.url),
  'utf8',
);
const controlFeaturesCss = readFileSync(
  new URL('../docs-site/control-features.css', import.meta.url),
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

test('the top bar carries toggle, server, search and account; the sidebar carries navigation only', () => {
  const barStart = controlHtml.indexOf('<header class="control-topbar"');
  const barEnd = controlHtml.indexOf('</header>', barStart);
  const asideStart = controlHtml.indexOf('<aside id="controlNavDrawer"');
  const asideEnd = controlHtml.indexOf('</aside>', asideStart);
  const bar = controlHtml.slice(barStart, barEnd);
  const aside = controlHtml.slice(asideStart, asideEnd);

  assert.ok(barStart >= 0 && barEnd < asideStart);
  const order = ['id="controlNavToggle"', 'id="controlServerButton"', 'id="controlSearch"', 'id="controlLogin"', 'id="controlAccountButton"']
    .map(marker => bar.indexOf(marker));
  assert.ok(order.every(index => index >= 0));
  assert.deepEqual([...order].sort((left, right) => left - right), order);
  assert.ok(bar.indexOf('id="controlIdentity"') < bar.indexOf('id="controlLogin"'));

  assert.ok(aside.indexOf('id="controlNavContent"') >= 0);
  assert.doesNotMatch(aside, /control-brand|control-appearance|id="controlIdentity"|data-theme-choice|server-picker|liveServerPicker/);
});

test('appearance defaults to System and resolves Dark, Light and System correctly', async () => {
  const {
    installThemeControls,
    resolveThemePreference,
  } = await import('../docs-site/control-theme.js');

  assert.deepEqual(
    resolveThemePreference(null, false),
    { preference: 'system', theme: 'light' },
  );
  assert.deepEqual(
    resolveThemePreference(null, true),
    { preference: 'system', theme: 'dark' },
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

  assert.equal(root.dataset.preference, 'system');
  assert.equal(root.dataset.theme, 'light');
  assert.equal(system.getAttribute('aria-pressed'), 'true');

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

test('appearance lives in the account menu as a Light, Dark, Auto segmented control', () => {
  const segment = controlHtml.indexOf('class="control-seg"');
  const end = controlHtml.indexOf('data-account-sign-out', segment);
  const block = controlHtml.slice(segment, end);

  assert.ok(block.indexOf('data-theme-choice="light"') >= 0);
  assert.ok(block.indexOf('data-theme-choice="light"') < block.indexOf('data-theme-choice="dark"'));
  assert.ok(block.indexOf('data-theme-choice="dark"') < block.indexOf('data-theme-choice="system"'));
  assert.match(block, />Light<\/button>[\s\S]*>Dark<\/button>[\s\S]*>Auto<\/button>/);
  assert.match(block, /data-theme-choice="system"[^>]*aria-pressed="true"/);
  assert.ok(controlHtml.indexOf('id="controlAccountMenu"') < segment);

  assert.match(
    controlHtml,
    /<html[^>]*data-theme=["']light["'][^>]*data-preference=["']system["']/,
  );
  assert.match(
    controlHtml,
    /localStorage\.getItem\(['"]rob-doc-theme['"]\)\s*\|\|\s*['"]system['"]/,
  );
});

test('account menu opens, closes with Escape, returns focus and signs out', async () => {
  const { installAccountMenu } = await import('../docs-site/control-account.js');

  const trigger = new FakeTarget();
  const menu = new FakeTarget();
  menu.style = {};
  menu.inert = true;
  menu.contains = target => target === menu;
  const first = new FakeTarget();
  menu.querySelectorAll = () => [first];
  const signOut = new FakeTarget();
  const doc = new FakeTarget();

  let signOutCount = 0;
  const controller = installAccountMenu({
    trigger,
    menu,
    signOut,
    doc,
    onSignOut: async () => {
      signOutCount += 1;
    },
  });

  assert.equal(menu.inert, true);
  await trigger.emit('click');
  assert.equal(menu.dataset.open, 'true');
  assert.equal(menu.inert, false);
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(first.focused, true);

  await doc.emit('keydown', { key: 'Escape', target: doc });
  assert.equal(menu.dataset.open, 'false');
  assert.equal(menu.inert, true);
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(trigger.focused, true);

  await trigger.emit('click');
  await doc.emit('click', { target: doc });
  assert.equal(menu.dataset.open, 'false');

  await signOut.emit('click');
  assert.equal(signOutCount, 1);

  controller.destroy();
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


test('shell uses derived layout states instead of fixed desktop bands', () => {
  assert.doesNotMatch(controlCss, /@media \(min-width: 900px\) and \(max-width: 1199px\)/);
  assert.doesNotMatch(controlCss, /@media \(min-width: 1200px\)/);
  assert.match(
    controlCss,
    /\.control-shell\[data-nav-mode="rail"\] \{ --nav-col: var\(--rail-w\); \}/,
  );
  assert.match(
    controlCss,
    /\.control-shell\[data-nav-mode="drawer"\] \.control-topbar \{[\s\S]*?grid-template-columns: auto minmax\(0, 1fr\);/,
  );
  assert.match(
    controlCss,
    /\.control-shell\[data-nav-mode="drawer"\] \.control-rail \{[\s\S]*?position: fixed;/,
  );
  assert.match(
    controlFeaturesCss,
    /@container control-main \(max-width: 600px\) \{[\s\S]*?\.content-feed-table td::before,[\s\S]*?content: attr\(data-label\);/,
  );
});
