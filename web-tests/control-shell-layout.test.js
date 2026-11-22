import assert from 'node:assert/strict';
import test from 'node:test';

import {
  NAV_PREFERENCE_KEY,
  SHELL_METRICS,
  installShellLayout,
  readNavPreference,
  resolveShellLayout,
  shellThresholds,
  writeNavPreference,
} from '../docs-site/control-shell-layout.js';

function layout(width, navPreference = 'auto') {
  return resolveShellLayout({ width, navPreference });
}

test('shell metrics match the 232/60/600 model with no context column', () => {
  assert.deepEqual(SHELL_METRICS, {
    edge: 12,
    gap: 12,
    rail: 60,
    labeled: 232,
    centerMin: 600,
    drawerBelow: 760,
  });
  assert.equal('right' in SHELL_METRICS, false);
});

test('thresholds contain only the drawer and labeled-navigation floors', () => {
  assert.deepEqual(shellThresholds(), { navDrawer: 760, labelsFit: 868 });
});

test('navigation becomes a drawer below 760px', () => {
  assert.equal(layout(759).navMode, 'drawer');
  assert.equal(layout(760).navMode, 'rail');
});

test('labeled navigation needs 868px: 232 + 600 + 12 gap + 24 gutters', () => {
  assert.equal(layout(867).navMode, 'rail');
  assert.equal(layout(868).navMode, 'expanded');
  assert.equal(layout(1440).navMode, 'expanded');
});

test('an explicit expanded choice keeps labels above the drawer floor', () => {
  assert.equal(layout(800, 'expanded').navMode, 'expanded');
});

test('an explicit collapsed choice keeps the rail when labels would fit', () => {
  assert.equal(layout(1400, 'collapsed').navMode, 'rail');
});

test('the drawer wins over an explicit expanded choice below 760px', () => {
  assert.equal(layout(640, 'expanded').navMode, 'drawer');
  assert.equal(layout(640, 'collapsed').navMode, 'drawer');
});

test('the resolver has no context column state', () => {
  const result = layout(1440);
  assert.equal('contextMode' in result, false);
  assert.equal('hasContext' in result, false);
});

test('invalid preferences fall back to automatic layout', () => {
  assert.equal(layout(1400, 'sideways').navMode, 'expanded');
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

test('installer sets nav mode only and reports only layout changes', () => {
  const listeners = new Map();
  const target = {
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
  };
  const shell = { dataset: {} };
  let width = 800;
  const seen = [];
  const controller = installShellLayout({
    shell,
    target,
    getWidth: () => width,
    getPreference: () => 'auto',
    onChange: value => seen.push(value),
  });

  assert.equal(shell.dataset.navMode, 'rail');
  assert.equal('contextMode' in shell.dataset, false);
  assert.equal(seen.length, 1);

  width = 700;
  listeners.get('resize')();
  assert.equal(shell.dataset.navMode, 'drawer');
  assert.equal(seen.length, 2);

  width = 650;
  listeners.get('resize')();
  assert.equal(seen.length, 2);

  width = 1120;
  controller.refresh();
  assert.equal(shell.dataset.navMode, 'expanded');
  assert.equal(seen.length, 3);

  controller.destroy();
  assert.equal(listeners.has('resize'), false);
});
