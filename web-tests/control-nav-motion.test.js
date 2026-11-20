import assert from 'node:assert/strict';
import test from 'node:test';

import { installNavMotion, NAV_ENTER_MS, NAV_MOTION_MS } from '../docs-site/control-nav-motion.js';

function fakeElement(initialDataset = {}) {
  const dataset = { ...initialDataset };
  const classes = new Set();
  return {
    dataset,
    classList: {
      add(name) {
        classes.add(name);
      },
      remove(name) {
        classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      },
    },
  };
}

function fakeTimers() {
  let now = 0;
  let nextHandle = 0;
  const queue = new Map();
  return {
    setTimeout(handler, delay = 0) {
      nextHandle += 1;
      queue.set(nextHandle, { handler, at: now + delay });
      return nextHandle;
    },
    clearTimeout(handle) {
      queue.delete(handle);
    },
    advance(ms) {
      now += ms;
      [...queue.entries()]
        .sort((left, right) => left[1].at - right[1].at)
        .forEach(([handle, job]) => {
          if (job.at > now) return;
          queue.delete(handle);
          job.handler();
        });
    },
    pending() {
      return queue.size;
    },
  };
}

function harness() {
  const shell = fakeElement({ navMode: 'expanded' });
  const nav = fakeElement();
  const timers = fakeTimers();
  const renders = [];
  const motion = installNavMotion({
    shell,
    nav,
    timers,
    render: () => {
      renders.push(shell.dataset.navMode);
      nav.dataset.navMode = shell.dataset.navMode;
    },
  });
  return { shell, nav, timers, renders, motion };
}

test('motion timings are shared with the stylesheet', () => {
  assert.equal(NAV_MOTION_MS, 200);
  assert.equal(NAV_ENTER_MS, 200);
});

test('the first render is immediate and unanimated', () => {
  const { shell, nav, renders, motion } = harness();
  motion.sync('expanded');
  assert.deepEqual(renders, ['expanded']);
  assert.equal(shell.dataset.navMotion, undefined);
  assert.equal(nav.classList.contains('control-nav-enter'), false);
});

test('collapsing renders the rail immediately and animates the shell', () => {
  const { shell, nav, timers, renders, motion } = harness();
  motion.sync('expanded');
  shell.dataset.navMode = 'rail';
  motion.sync('rail');
  assert.deepEqual(renders, ['expanded', 'rail']);
  assert.equal(shell.dataset.navMotion, 'true');
  assert.equal(nav.classList.contains('control-nav-enter'), true);
  timers.advance(NAV_MOTION_MS);
  assert.equal(shell.dataset.navMotion, undefined);
});

test('expanding waits for the rail width before swapping the markup', () => {
  const { shell, nav, timers, renders, motion } = harness();
  motion.sync('expanded');
  shell.dataset.navMode = 'rail';
  motion.sync('rail');
  timers.advance(NAV_MOTION_MS);
  renders.length = 0;

  shell.dataset.navMode = 'expanded';
  motion.sync('expanded');
  assert.deepEqual(renders, []);
  timers.advance(NAV_MOTION_MS - 1);
  assert.deepEqual(renders, []);
  timers.advance(1);
  assert.deepEqual(renders, ['expanded']);
  assert.equal(nav.dataset.navMode, 'expanded');
});

test('returning to the rail before the expansion finishes cancels the swap', () => {
  const { shell, timers, renders, motion } = harness();
  motion.sync('expanded');
  shell.dataset.navMode = 'rail';
  motion.sync('rail');
  timers.advance(NAV_MOTION_MS);
  renders.length = 0;

  shell.dataset.navMode = 'expanded';
  motion.sync('expanded');
  timers.advance(80);
  shell.dataset.navMode = 'rail';
  motion.sync('rail');
  timers.advance(NAV_MOTION_MS);
  assert.deepEqual(renders, []);
});

test('the enter animation class clears after the enter duration', () => {
  const { shell, nav, timers, motion } = harness();
  motion.sync('expanded');
  shell.dataset.navMode = 'rail';
  motion.sync('rail');
  assert.equal(nav.classList.contains('control-nav-enter'), true);
  timers.advance(NAV_ENTER_MS);
  assert.equal(nav.classList.contains('control-nav-enter'), false);
});

test('destroy clears timers, classes, and the motion attribute', () => {
  const { shell, nav, timers, motion } = harness();
  motion.sync('expanded');
  shell.dataset.navMode = 'rail';
  motion.sync('rail');
  motion.destroy();
  assert.equal(timers.pending(), 0);
  assert.equal(nav.classList.contains('control-nav-enter'), false);
  assert.equal(shell.dataset.navMotion, undefined);
});
