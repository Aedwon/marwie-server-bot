import assert from 'node:assert/strict';
import test from 'node:test';

import { installNavHoverExpand } from '../docs-site/control-nav-hover.js';

function fakeRail() {
  const listeners = new Map();
  return {
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    removeEventListener(type) {
      listeners.delete(type);
    },
    fire(type) {
      listeners.get(type)?.({ type });
    },
    listeners,
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

function controller(overrides = {}) {
  const rail = fakeRail();
  const timers = fakeTimers();
  const events = [];
  const instance = installNavHoverExpand({
    rail,
    timers,
    getMode: () => 'rail',
    expand: () => events.push('expand'),
    collapse: () => events.push('collapse'),
    ...overrides,
  });
  return { rail, timers, events, instance };
}

test('hovering the collapsed rail expands it after a short delay', () => {
  const { rail, timers, events, instance } = controller();
  rail.fire('mouseenter');
  assert.deepEqual(events, []);
  timers.advance(150);
  assert.deepEqual(events, ['expand']);
  assert.equal(instance.isExpanded(), true);
});

test('hover does nothing outside rail mode or on touch pointers', () => {
  const expanded = controller({ getMode: () => 'expanded' });
  expanded.rail.fire('mouseenter');
  expanded.timers.advance(500);
  assert.deepEqual(expanded.events, []);

  const touch = controller({ isHoverCapable: () => false });
  touch.rail.fire('mouseenter');
  touch.timers.advance(500);
  assert.deepEqual(touch.events, []);
});

test('leaving the rail collapses it again', () => {
  const { rail, timers, events, instance } = controller();
  rail.fire('mouseenter');
  timers.advance(150);
  rail.fire('mouseleave');
  assert.deepEqual(events, ['expand']);
  timers.advance(200);
  assert.deepEqual(events, ['expand', 'collapse']);
  assert.equal(instance.isExpanded(), false);
});

test('leaving before the open delay cancels the expansion', () => {
  const { rail, timers, events } = controller();
  rail.fire('mouseenter');
  timers.advance(60);
  rail.fire('mouseleave');
  timers.advance(500);
  assert.deepEqual(events, []);
});

test('focus inside the rail keeps it open until focus leaves', () => {
  let focused = true;
  const { rail, timers, events } = controller({ hasFocusInside: () => focused });
  rail.fire('mouseenter');
  timers.advance(150);
  rail.fire('mouseleave');
  timers.advance(500);
  assert.deepEqual(events, ['expand']);

  focused = false;
  rail.fire('focusout');
  timers.advance(200);
  assert.deepEqual(events, ['expand', 'collapse']);
});

test('reset collapses the state without firing the collapse callback', () => {
  const { rail, timers, events, instance } = controller();
  rail.fire('mouseenter');
  timers.advance(150);
  assert.equal(instance.isExpanded(), true);
  instance.reset();
  assert.equal(instance.isExpanded(), false);
  assert.deepEqual(events, ['expand']);
  rail.fire('mouseleave');
  timers.advance(500);
  assert.deepEqual(events, ['expand']);
});

test('expands with the built-in timers when none are supplied', async () => {
  const rail = fakeRail();
  const events = [];
  const instance = installNavHoverExpand({
    rail,
    getMode: () => 'rail',
    expand: () => events.push('expand'),
    openDelay: 1,
  });
  rail.fire('mouseenter');
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.deepEqual(events, ['expand']);
  instance.destroy();
});

test('destroy removes listeners and pending timers', () => {
  const { rail, timers, instance } = controller();
  rail.fire('mouseenter');
  instance.destroy();
  assert.equal(rail.listeners.size, 0);
  assert.equal(timers.pending(), 0);
  timers.advance(500);
});
