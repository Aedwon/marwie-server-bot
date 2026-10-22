import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NAV_PREFERENCE_KEY,
  SHELL_METRICS,
  installShellLayout,
  readNavPreference,
  resolveShellLayout,
  writeNavPreference,
} from '../docs-site/control-shell-layout.js';

function layout(width, hasContext, navPreference = 'auto') {
  return resolveShellLayout({ width, hasContext, navPreference });
}

test('shell metrics match the approved 240/64/304/600 model', () => {
  assert.deepEqual(SHELL_METRICS, {
    edge: 12,
    gap: 12,
    rail: 64,
    labeled: 240,
    right: 304,
    centerMin: 600,
  });
});

test('navigation becomes a drawer below 700px', () => {
  assert.equal(layout(699, false).navMode, 'drawer');
  assert.equal(layout(700, false).navMode, 'rail');
  assert.equal(layout(699, true).navMode, 'drawer');
  assert.equal(layout(700, true).navMode, 'rail');
});

test('labeled navigation needs 876px without context', () => {
  assert.equal(layout(875, false).navMode, 'rail');
  assert.equal(layout(876, false).navMode, 'expanded');
  assert.equal(layout(1120, false).navMode, 'expanded');
});

test('context column needs 1016px with the rail', () => {
  assert.equal(layout(1015, true).navMode, 'rail');
  assert.equal(layout(1015, true).contextMode, 'drawer');
  assert.equal(layout(1016, true).navMode, 'rail');
  assert.equal(layout(1016, true).contextMode, 'column');
});

test('context column needs 1192px with labeled navigation', () => {
  assert.equal(layout(1191, true).navMode, 'rail');
  assert.equal(layout(1191, true).contextMode, 'column');
  assert.equal(layout(1192, true).navMode, 'expanded');
  assert.equal(layout(1192, true).contextMode, 'column');
});

test('an explicit expanded choice turns the context panel into a drawer when labels do not fit', () => {
  const result = layout(1120, true, 'expanded');
  assert.equal(result.navMode, 'expanded');
  assert.equal(result.contextMode, 'drawer');
});

test('an explicit collapsed choice keeps the rail when labels would fit', () => {
  assert.equal(layout(1400, false, 'collapsed').navMode, 'rail');
  assert.equal(layout(1400, true, 'collapsed').contextMode, 'column');
});

test('the drawer wins over an explicit expanded choice below 700px', () => {
  assert.equal(layout(640, false, 'expanded').navMode, 'drawer');
  assert.equal(layout(640, true, 'expanded').contextMode, 'drawer');
});

test('pages without context reserve no context column', () => {
  assert.equal(layout(1400, false).contextMode, 'none');
});

test('invalid preferences fall back to automatic layout', () => {
  assert.equal(layout(1400, false, 'sideways').navMode, 'expanded');
});

test('navigation preference reads and writes safely', () => {
  const values = new Map();
  const storage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };

  assert.equal(NAV_PREFERENCE_KEY, 'rob-control-nav-preference');
  assert.equal(readNavPreference(storage), 'auto');
  writeNavPreference(storage, 'collapsed');
  assert.equal(readNavPreference(storage), 'collapsed');
  writeNavPreference(storage, 'nonsense');
  assert.equal(readNavPreference(storage), 'auto');
});

test('installer sets shell state and reports only layout changes', () => {
  const listeners = new Map();
  const target = {
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
  };
  const shell = { dataset: { context: 'true' } };
  let width = 1120;
  const seen = [];
  const controller = installShellLayout({
    shell,
    target,
    getWidth: () => width,
    getPreference: () => 'auto',
    onChange: value => seen.push(value),
  });

  assert.equal(shell.dataset.navMode, 'rail');
  assert.equal(shell.dataset.contextMode, 'column');
  assert.equal(seen.length, 1);

  width = 1015;
  listeners.get('resize')();
  assert.equal(shell.dataset.navMode, 'rail');
  assert.equal(shell.dataset.contextMode, 'drawer');
  assert.equal(seen.length, 2);

  width = 1014;
  listeners.get('resize')();
  assert.equal(seen.length, 2);

  shell.dataset.context = 'false';
  width = 1120;
  controller.refresh();
  assert.equal(shell.dataset.navMode, 'expanded');
  assert.equal(shell.dataset.contextMode, 'none');

  controller.destroy();
  assert.equal(listeners.has('resize'), false);
});
