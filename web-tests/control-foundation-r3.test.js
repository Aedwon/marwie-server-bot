import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { pageMarkup } from '../docs-site/control-components.js';
import { mountControlDestination } from '../docs-site/control-page-adapter.js';
import { resolveControlRoute } from '../docs-site/control-router.js';

const controlHtml = readFileSync(
  new URL('../docs-site/control.html', import.meta.url),
  'utf8',
);
const controlLive = readFileSync(
  new URL('../docs-site/control-live.js', import.meta.url),
  'utf8',
);

class FakeElement {
  constructor({
    id = '',
    tagName = 'div',
    classes = [],
    dataset = {},
    children = [],
  } = {}) {
    this.id = id;
    this.tagName = tagName.toLowerCase();
    this.classList = new Set(classes);
    this.dataset = { ...dataset };
    this.parentNode = null;
    this.children = [];
    this.innerHTML = '';
    this.hidden = false;
    this.executionCount = 0;
    this.append(...children);
  }

  append(...nodes) {
    for (const node of nodes) {
      node.remove?.();
      node.parentNode = this;
      this.children.push(node);
    }
  }

  insertBefore(node, reference) {
    node.remove?.();
    const index = reference ? this.children.indexOf(reference) : -1;
    node.parentNode = this;
    if (index < 0) this.children.push(node);
    else this.children.splice(index, 0, node);
  }

  remove() {
    if (!this.parentNode?.children) return;
    const index = this.parentNode.children.indexOf(this);
    if (index >= 0) this.parentNode.children.splice(index, 1);
    this.parentNode = null;
  }

  replaceChildren(...nodes) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    this.append(...nodes);
    this.innerHTML = '';
  }

  get nextSibling() {
    if (!this.parentNode?.children) return null;
    const index = this.parentNode.children.indexOf(this);
    return index >= 0 ? this.parentNode.children[index + 1] || null : null;
  }

  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector === 'details') return this.tagName === 'details';
    if (selector === '.row-action') return this.classList.has('row-action');

    const dataAction = selector.match(/^\[data-prototype-action="(.+)"\]$/);
    if (dataAction) return this.dataset.prototypeAction === dataAction[1];

    return false;
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (node.matches?.(selector)) return node;
      node = node.parentNode;
    }
    return null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = node => {
      if (node.matches?.(selector)) matches.push(node);
      for (const child of node.children || []) visit(child);
    };
    for (const child of this.children) visit(child);
    return matches;
  }

  execute() {
    this.executionCount += 1;
  }
}

function buildLegacyMount({
  sectionId,
  legitimateId,
  restrictedId,
  restrictedOwnerTag = 'div',
  restrictedOwnerClasses = [],
  restrictedDataset = {},
}) {
  const legitimate = new FakeElement({ id: legitimateId });
  const restrictedControl = new FakeElement({
    id: restrictedId,
    dataset: restrictedDataset,
  });
  const restrictedOwner = new FakeElement({
    id: `${restrictedId}-owner`,
    tagName: restrictedOwnerTag,
    classes: restrictedOwnerClasses,
    children: [restrictedControl],
  });
  const section = new FakeElement({
    id: sectionId,
    children: [legitimate, restrictedOwner],
  });
  const legacyRoot = new FakeElement({ id: 'controlLegacyHost', children: [section] });
  const main = new FakeElement({ id: 'controlMain' });

  return {
    legitimate,
    restrictedControl,
    restrictedOwner,
    section,
    legacyRoot,
    main,
  };
}

test('canonical Ticket Configuration leaves the legacy ticket section and Commands-only refresh off-page', () => {
  const fixture = buildLegacyMount({
    sectionId: 'tickets',
    legitimateId: 'ticketTypeEditor',
    restrictedId: 'refreshTicketPanel',
    restrictedOwnerClasses: ['row-action', 'dependent-action'],
    restrictedDataset: { prototypeAction: 'Post ticket panel' },
  });

  mountControlDestination({
    main: fixture.main,
    destination: resolveControlRoute('/control/utilities/ticket-configuration'),
    legacyRoot: fixture.legacyRoot,
    renderFallback: destination => `<h1>${destination.label}</h1>`,
  });

  assert.equal(fixture.main.querySelector('#ticketTypeEditor'), null);
  assert.equal(fixture.main.querySelector('#refreshTicketPanel'), null);
  assert.match(fixture.main.innerHTML, /Ticket configuration/);
  assert.equal(fixture.legacyRoot.querySelector('#ticketTypeEditor'), fixture.legitimate);
  assert.equal(fixture.legacyRoot.querySelector('#refreshTicketPanel'), fixture.restrictedControl);
  assert.equal(fixture.restrictedControl.executionCount, 0);
});

test('canonical Feeds leaves the entire legacy feed section outside the mounted page', () => {
  const fixture = buildLegacyMount({
    sectionId: 'feeds',
    legitimateId: 'feedSourceForm',
    restrictedId: 'pollFeeds',
    restrictedOwnerClasses: ['row-action', 'dependent-action'],
    restrictedDataset: { prototypeAction: 'Poll feeds' },
  });

  mountControlDestination({
    main: fixture.main,
    destination: resolveControlRoute('/control/content/feeds'),
    legacyRoot: fixture.legacyRoot,
    renderFallback: destination => `<h1>${destination.label}</h1>`,
  });

  assert.equal(fixture.main.querySelector('#feedSourceForm'), null);
  assert.equal(fixture.main.querySelector('#pollFeeds'), null);
  assert.match(fixture.main.innerHTML, /Feeds/);
  assert.equal(fixture.legacyRoot.querySelector('#feedSourceForm'), fixture.legitimate);
  assert.equal(fixture.legacyRoot.querySelector('#pollFeeds'), fixture.restrictedControl);
  assert.equal(fixture.restrictedControl.executionCount, 0);
});

test('legacy markup and runtime retain the three Commands-only actions outside canonical ownership', () => {
  assert.match(
    controlHtml,
    /Manual adjustment[\s\S]*?id="repReviewBtn"/,
  );
  assert.match(
    controlHtml,
    /data-prototype-action="Post ticket panel"[^>]*>Post \/ refresh panel/,
  );
  assert.match(
    controlHtml,
    /data-prototype-action="Poll feeds"[^>]*>Poll now/,
  );

  assert.match(controlLive, /queueAction\('adjust_reputation'/);
  assert.match(controlLive, /queueAction\('refresh_ticket_panel'/);
  assert.match(controlLive, /queueAction\('poll_ai_sources'/);
});

test('workflow renderer is guidance-only without duplicated page status chrome', () => {
  for (const path of [
    '/control/workflows/moderation',
    '/control/workflows/ticket-handling',
    '/control/workflows/events',
  ]) {
    const destination = resolveControlRoute(path);
    const markup = pageMarkup(destination, {
      authenticated: true,
      state: { bot: { online: true } },
      snapshot: { fresh: true, updated_at: '2026-08-28T03:00:00Z' },
    });

    assert.match(markup, new RegExp(`<h1>${destination.label}</h1>`));
    assert.match(markup, /Operational guidance/);
    assert.doesNotMatch(markup, /control-eyebrow/);
    assert.doesNotMatch(markup, /control-state-chip/);
    assert.doesNotMatch(markup, /control-read-summary/);
    assert.doesNotMatch(markup, /<(?:form|input|select|textarea|button)\b/i);
    assert.doesNotMatch(markup, /Edit settings|Save changes/i);
  }
});

test('generic fallback renderer avoids repeating shell-level health metadata', () => {
  const destination = resolveControlRoute('/control/analytics');
  const markup = pageMarkup(destination, {
    authenticated: true,
    state: { bot: { online: true } },
    snapshot: { fresh: true, updated_at: '2026-08-28T03:00:00Z' },
  });

  assert.match(markup, /<h1>Analytics<\/h1>/);
  assert.match(markup, /Review the current Rob-bot state for Analytics\./);
  assert.doesNotMatch(markup, /control-eyebrow/);
  assert.doesNotMatch(markup, /control-state-chip/);
  assert.doesNotMatch(markup, /control-read-summary/);
  assert.doesNotMatch(markup, /Fresh server state|Snapshot:|Rob-bot:/);
});
