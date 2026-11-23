import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createNavigationState, installDrawerController, navigationModel } from '../docs-site/control-navigation.js';
import { destinationForPath } from '../docs-site/control-router.js';
import { navigationMarkup, resolveIndicatorTarget } from '../docs-site/control-shell.js';
import { installNavHoverExpand } from '../docs-site/control-nav-hover.js';

const site = name => readFileSync(new URL(`../docs-site/${name}`, import.meta.url), 'utf8');

test('indicator sits on the current leaf when its group is open', () => {
  const rows = [
    { key: 'engagement', kind: 'group', group: 'engagement', open: true, current: false },
    { key: '/control/community/reputation', kind: 'leaf', group: 'engagement', current: true },
    { key: '/control/community/quizzes', kind: 'leaf', group: 'engagement', current: false },
  ];
  assert.equal(resolveIndicatorTarget(rows), '/control/community/reputation');
});

test('indicator falls back to the group row when the current leaf group is collapsed', () => {
  const rows = [
    { key: 'engagement', kind: 'group', group: 'engagement', open: false, current: false },
    { key: '/control/community/reputation', kind: 'leaf', group: 'engagement', current: true },
    { key: 'publishing', kind: 'group', group: 'publishing', open: true, current: false },
  ];
  assert.equal(resolveIndicatorTarget(rows), 'engagement');
});

test('indicator sits on a top-level link and is absent when nothing is current', () => {
  const rows = [
    { key: 'engagement', kind: 'group', group: 'engagement', open: true, current: false },
    { key: 'resources', kind: 'link', group: null, current: true },
  ];
  assert.equal(resolveIndicatorTarget(rows), 'resources');
  assert.equal(resolveIndicatorTarget(rows.map(row => ({ ...row, current: false }))), null);
  assert.equal(resolveIndicatorTarget([]), null);
});

test('navigation order: Overview, four groups, Resources, Playbooks, Reference; no System', () => {
  const model = navigationModel(destinationForPath('/control/analytics'), 'insights');
  assert.deepEqual(model.items.map(item => item.key || `label:${item.label}`), [
    'overview', 'engagement', 'publishing', 'support-safety', 'insights', 'resources',
    'label:Playbooks', 'ticket-handling', 'events',
    'label:Reference', 'commands', 'handbook',
  ]);
  const resources = model.items.find(item => item.key === 'resources');
  assert.equal(resources.type, 'link');
  assert.equal(resources.path, '/control/mappings/channels');
  const insights = model.items.find(item => item.key === 'insights');
  assert.deepEqual(insights.children.map(child => child.path), ['/control/analytics', '/control/activity']);
  assert.equal(model.items.filter(item => item.expanded).length, 1);
  assert.equal(model.items.some(item => item.key === 'system'), false);
  const overview = model.items[0];
  assert.deepEqual([overview.type, overview.key, overview.path, overview.icon], ['link', 'overview', '/control/overview', 'house']);
  assert.equal(navigationModel(destinationForPath('/control/overview'), 'engagement').items[0].current, true);
});

test('Resources keeps the remembered mapping child and is current for all three mapping routes', () => {
  const remembered = navigationModel(destinationForPath('/control/analytics'), 'insights', { mappings: '/control/mappings/roles' });
  assert.equal(remembered.items.find(item => item.key === 'resources').path, '/control/mappings/roles');
  for (const path of ['/control/mappings/channels', '/control/mappings/roles', '/control/mappings/categories']) {
    const model = navigationModel(destinationForPath(path), 'engagement');
    assert.equal(model.items.find(item => item.key === 'resources').current, true, path);
  }
});

test('Reference links point at the public documents and mark the matching document current', () => {
  const commands = navigationModel({ path: '/commands' }, 'engagement');
  assert.equal(commands.items.find(item => item.key === 'commands').path, '/commands');
  assert.equal(commands.items.find(item => item.key === 'commands').current, true);
  assert.equal(commands.items.find(item => item.key === 'handbook').current, false);
  const handbook = navigationModel({ path: '/handbook' }, 'engagement');
  assert.equal(handbook.items.find(item => item.key === 'handbook').path, '/handbook');
  assert.equal(handbook.items.find(item => item.key === 'handbook').current, true);
  const inControl = navigationModel(destinationForPath('/control/overview'), 'engagement');
  assert.equal(inControl.items.find(item => item.key === 'commands').current, false);
});

test('rail and expanded produce identical nav markup', () => {
  const model = navigationModel(destinationForPath('/control/community/quizzes'), 'engagement');
  const expanded = navigationMarkup(model);
  assert.equal(navigationMarkup(model, { rail: true }), expanded);
  assert.equal(navigationMarkup.length <= 2, true);
  assert.doesNotMatch(expanded, /sr-only/);
  assert.match(expanded, /control-nav-lbl">Reputation</);
});

test('nav markup: one indicator, group rows with icon and chevron, leaf rows without icons', () => {
  const model = navigationModel(destinationForPath('/control/community/quizzes'), 'engagement');
  const html = navigationMarkup(model);
  assert.equal((html.match(/data-nav-indicator/g) || []).length, 1);
  const groups = html.match(/<button[^>]*data-domain-select[\s\S]*?<\/button>/g);
  assert.equal(groups.length, 4);
  for (const group of groups) {
    assert.match(group, /control-nav-group-icon/);
    assert.match(group, /control-nav-chev/);
    assert.match(group, /aria-expanded="(true|false)"/);
  }
  const leaves = html.match(/<a [^>]*control-nav-leaf[^>]*>[\s\S]*?<\/a>/g);
  assert.equal(leaves.length, 5 + 3 + 3 + 2);
  for (const leaf of leaves) assert.doesNotMatch(leaf, /<svg/);
  assert.match(html, /<p class="control-nav-label">Playbooks<\/p>/);
  assert.match(html, /<p class="control-nav-label">Reference<\/p>/);
  assert.match(html, /href="\/commands"/);
  assert.match(html, /href="\/handbook"/);
  assert.match(html, /aria-current="page"[^>]*>[\s\S]{0,80}Quizzes|Quizzes[\s\S]{0,0}/);
});

test('collapsed groups keep their children out of the tab order and use grid rows', () => {
  const model = navigationModel(destinationForPath('/control/community/quizzes'), 'engagement');
  const html = navigationMarkup(model);
  const engagement = html.match(/<div class="control-nav-group"[^>]*data-domain="engagement"[\s\S]*?(?=<div class="control-nav-group")/)[0];
  assert.match(engagement, /data-open="true"/);
  assert.doesNotMatch(engagement, /tabindex="-1"/);
  const publishing = html.match(/<div class="control-nav-group"[^>]*data-domain="publishing"[\s\S]*?(?=<div class="control-nav-group")/)[0];
  assert.match(publishing, /data-open="false"/);
  assert.equal((publishing.match(/tabindex="-1"/g) || []).length, 3);
  assert.match(html, /class="control-nav-kids"/);
});

test('flags render only for problems and a closed group carries its children flags', () => {
  const model = navigationModel(destinationForPath('/control/community/quizzes'), 'engagement', {}, {
    flags: new Set(['/control/content/live']),
  });
  const html = navigationMarkup(model);
  assert.equal((html.match(/control-nav-flag/g) || []).length, 2);
  const healthy = navigationMarkup(navigationModel(destinationForPath('/control/community/quizzes'), 'engagement'));
  assert.doesNotMatch(healthy, /control-nav-flag/);
});

test('selecting a route reveals its group once and leaves the markup unchanged for mode changes', () => {
  const state = createNavigationState({ currentPath: '/control/content/live' });
  assert.equal(state.expandedDomain, 'publishing');
  const source = site('control-app.js');
  assert.equal((source.match(/navigationMarkup\(/g) || []).length, 0);
  assert.doesNotMatch(source, /installNavMotion|revealNavigationDomain|control-nav-reflow/);
});

test('peek opens after 150ms and closes after 200ms', () => {
  const handlers = new Map();
  const rail = { addEventListener: (type, fn) => handlers.set(type, fn), removeEventListener() {} };
  const queue = [];
  const timers = {
    setTimeout: (fn, ms) => { queue.push({ fn, ms }); return queue.length; },
    clearTimeout: () => {},
  };
  const events = [];
  installNavHoverExpand({
    rail,
    timers,
    getMode: () => 'rail',
    expand: () => events.push('open'),
    collapse: () => events.push('close'),
  });
  handlers.get('mouseenter')();
  assert.equal(queue.at(-1).ms, 150);
  queue.at(-1).fn();
  handlers.get('mouseleave')();
  assert.equal(queue.at(-1).ms, 200);
  queue.at(-1).fn();
  assert.deepEqual(events, ['open', 'close']);
});

function fakeDrawerEnvironment() {
  class FakeElement {
    constructor(name) {
      this.name = name;
      this.dataset = {};
      this.attributes = new Map();
      this.inert = false;
      this.listeners = new Map();
    }
    setAttribute(key, value) { this.attributes.set(key, String(value)); }
    removeAttribute(key) { this.attributes.delete(key); }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    addEventListener(type, fn) { this.listeners.set(type, fn); }
    removeEventListener(type) { this.listeners.delete(type); }
    focus() { globalThis.document.activeElement = this; }
  }
  globalThis.HTMLElement = FakeElement;
  globalThis.document = { activeElement: null };
  const first = new FakeElement('first');
  const last = new FakeElement('last');
  const drawer = new FakeElement('drawer');
  drawer.querySelectorAll = () => [first, last];
  const trigger = new FakeElement('trigger');
  const closeButton = new FakeElement('close');
  const main = new FakeElement('main');
  const controller = installDrawerController({
    drawer,
    trigger,
    closeButton,
    isDrawer: () => true,
    background: () => [main],
  });
  return { drawer, trigger, main, first, last, controller };
}

test('drawer: closed drawer is inert; open moves focus in and makes the background inert', () => {
  const env = fakeDrawerEnvironment();
  assert.equal(env.drawer.inert, true);
  assert.equal(env.drawer.getAttribute('aria-hidden'), 'true');
  env.trigger.focus();
  env.trigger.listeners.get('click')({});
  assert.equal(env.drawer.dataset.open, 'true');
  assert.equal(env.drawer.inert, false);
  assert.equal(globalThis.document.activeElement, env.first);
  assert.equal(env.main.inert, true);
  assert.equal(env.trigger.getAttribute('aria-expanded'), 'true');
});

test('drawer: Tab wraps at both edges and Escape closes, restores focus and clears inert', () => {
  const env = fakeDrawerEnvironment();
  env.trigger.focus();
  env.trigger.listeners.get('click')({});
  let prevented = 0;
  env.last.focus();
  env.drawer.listeners.get('keydown')({ key: 'Tab', shiftKey: false, preventDefault: () => { prevented += 1; } });
  assert.equal(globalThis.document.activeElement, env.first);
  env.drawer.listeners.get('keydown')({ key: 'Tab', shiftKey: true, preventDefault: () => { prevented += 1; } });
  assert.equal(globalThis.document.activeElement, env.last);
  assert.equal(prevented, 2);
  env.drawer.listeners.get('keydown')({ key: 'Escape', preventDefault: () => { prevented += 1; } });
  assert.equal(env.drawer.dataset.open, 'false');
  assert.equal(env.drawer.inert, true);
  assert.equal(env.main.inert, false);
  assert.equal(globalThis.document.activeElement, env.trigger);
});

function section(html, openTag, closeTag) {
  const start = html.indexOf(openTag);
  assert.notEqual(start, -1, `missing ${openTag}`);
  const end = html.indexOf(closeTag, start);
  assert.notEqual(end, -1, `missing ${closeTag}`);
  return html.slice(start, end + closeTag.length);
}
const normalize = markup => markup.replaceAll(' aria-current="page"', '').replace(/\s+/g, ' ');

test('control, commands and handbook render the identical top bar and sidebar', () => {
  const docs = ['control.html', 'commands.html', 'index.html'].map(name => site(name));
  const bars = docs.map(html => normalize(section(html, '<header class="control-topbar"', '</header>')));
  const sides = docs.map(html => normalize(section(html, '<aside id="controlNavDrawer"', '</aside>')));
  assert.equal(bars[1], bars[0]);
  assert.equal(bars[2], bars[0]);
  assert.equal(sides[1], sides[0]);
  assert.equal(sides[2], sides[0]);
  const expected = normalize(navigationMarkup(navigationModel({ path: '/none' }, 'engagement')));
  assert.equal(sides[0].includes(expected), true);
  assert.match(docs[1], /href="\/commands"[^>]*aria-current="page"/);
  assert.match(docs[2], /href="\/handbook"[^>]*aria-current="page"/);
  for (const html of docs) {
    assert.match(html, /<link rel="stylesheet" href="\/control\.css\?v=\d+">/);
    assert.match(html, /@view-transition|rel="stylesheet" href="\/control\.css/);
    for (const id of ['controlNavToggle', 'controlMenuButton', 'controlServerButton', 'controlSearch', 'controlAccountButton', 'controlOffline']) {
      assert.match(html, new RegExp(`id="${id}"`), id);
    }
    assert.match(html, /<main id="controlMain"/);
  }
});

test('the three documents boot the shared shell', () => {
  assert.match(site('commands.js'), /from '\.\/control-shell\.js\?v=\d+'/);
  assert.match(site('app.js'), /from '\.\/control-shell\.js\?v=\d+'/);
  assert.match(site('control-app.js'), /from '\.\/control-shell\.js\?v=\d+'/);
  assert.match(site('index.html'), /<script type="module" src="\/app\.js\?v=\d+">/);
});

test('cross-document view transitions are enabled with stable names for the shell', () => {
  const css = site('control.css');
  assert.match(css, /@view-transition\s*\{\s*navigation:\s*auto;\s*\}/);
  assert.match(css, /view-transition-name:\s*control-topbar/);
  assert.match(css, /view-transition-name:\s*control-sidebar/);
});
