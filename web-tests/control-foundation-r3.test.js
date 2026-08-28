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

class FakeElement {
  constructor({ id = '', owner = null, children = [] } = {}) {
    this.id = id;
    this.dataset = owner ? { controlOwner: owner } : {};
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

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = node => {
      if (selector.startsWith('#') && node.id === selector.slice(1)) {
        matches.push(node);
      } else if (
        selector === '[data-control-owner="commands"]'
        && node.dataset?.controlOwner === 'commands'
      ) {
        matches.push(node);
      }
      for (const child of node.children || []) visit(child);
    };
    for (const child of this.children) visit(child);
    return matches;
  }

  execute() {
    this.executionCount += 1;
  }
}

function buildLegacyMount({ sectionId, legitimateId, restrictedId }) {
  const legitimate = new FakeElement({ id: legitimateId });
  const restrictedControl = new FakeElement({ id: restrictedId });
  const restrictedOwner = new FakeElement({
    id: `${restrictedId}-owner`,
    owner: 'commands',
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

test('canonical feature destinations detach Commands-only legacy controls and restore them off-page', () => {
  const cases = [
    {
      path: '/control/community/reputation',
      sectionId: 'reputation',
      legitimateId: 'thresholdEditor',
      restrictedId: 'repReviewBtn',
    },
    {
      path: '/control/utilities/ticket-configuration',
      sectionId: 'tickets',
      legitimateId: 'ticketTypeEditor',
      restrictedId: 'refreshTicketPanel',
    },
    {
      path: '/control/content/feeds',
      sectionId: 'feeds',
      legitimateId: 'feedSourceForm',
      restrictedId: 'pollFeeds',
    },
  ];

  for (const scenario of cases) {
    const fixture = buildLegacyMount(scenario);

    mountControlDestination({
      main: fixture.main,
      destination: resolveControlRoute(scenario.path),
      legacyRoot: fixture.legacyRoot,
      renderFallback: destination => `<h1>${destination.label}</h1>`,
    });

    assert.equal(
      fixture.main.querySelector(`#${scenario.legitimateId}`),
      fixture.legitimate,
      `${scenario.path} must keep its neighboring owned capability`,
    );

    const exposed = fixture.main.querySelector(`#${scenario.restrictedId}`);
    exposed?.execute();
    assert.equal(
      exposed,
      null,
      `${scenario.path} must not expose its Commands-only action`,
    );
    assert.equal(
      fixture.restrictedControl.executionCount,
      0,
      `${scenario.path} must not make its Commands-only action executable`,
    );

    mountControlDestination({
      main: fixture.main,
      destination: resolveControlRoute('/control/commands'),
      legacyRoot: fixture.legacyRoot,
      renderFallback: destination => `<h1>${destination.label}</h1>`,
    });

    assert.equal(
      fixture.section.querySelector(`#${scenario.restrictedId}`),
      fixture.restrictedControl,
      'detached legacy controls must be restored outside the canonical feature page',
    );
  }
});

test('legacy markup explicitly marks only the three Commands-owned transitional controls', () => {
  const ownershipMarkers = controlHtml.match(/data-control-owner="commands"/g) || [];
  assert.equal(ownershipMarkers.length, 3);

  assert.match(
    controlHtml,
    /<details[^>]*data-control-owner="commands"[^>]*>[\s\S]*?Manual adjustment[\s\S]*?id="repReviewBtn"/,
  );
  assert.match(
    controlHtml,
    /<div[^>]*data-control-owner="commands"[^>]*>[\s\S]*?Post \/ refresh panel/,
  );
  assert.match(
    controlHtml,
    /<div[^>]*data-control-owner="commands"[^>]*>[\s\S]*?Poll now/,
  );
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
