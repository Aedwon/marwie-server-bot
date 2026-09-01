import assert from 'node:assert/strict';
import test from 'node:test';

import { createControlStateStore } from '../docs-site/control-state.js';
import { createCommunityPageDefinition } from '../docs-site/control-community.js';
import { createUtilitiesPageDefinition } from '../docs-site/control-utilities.js';
import { createAnalyticsPageDefinition } from '../docs-site/control-analytics.js';

function renderDefinition(definition, snapshot) {
  const store = createControlStateStore();
  store.register(definition);
  store.hydrate(definition.pageKey, snapshot, 'a'.repeat(64));
  return definition.render({ state: store.get(definition.pageKey), snapshot });
}

test('Community feature pages adopt the shared top-right feature control and Classic mapping table', () => {
  const snapshot = {
    features: [{ name: 'reputation', enabled: true, config: {} }],
    reputation: { thresholds: { builder: 50, contributor: 150, mentor: 500 } },
    resources: [
      { key: 'builder_role', id: '1', name: 'Builder', exists: true, kind: 'role' },
      { key: 'contributor_role', id: null, name: null, exists: false, kind: null },
      { key: 'mentor_role', id: '3', name: null, exists: false, kind: 'role' },
    ],
  };
  const markup = renderDefinition(createCommunityPageDefinition('/control/community/reputation'), snapshot);
  assert.equal(markup.includes('control-feature-header-actions'), true);
  assert.equal(markup.includes('aria-label=\"Reputation enabled\"'), false);
  assert.equal(markup.includes('type=\"checkbox\"'), false);
  assert.equal(markup.includes('data-community-edit'), true);
  assert.equal(markup.includes('Feature status'), false);
  assert.equal(markup.includes('<table class=\"control-summary-table\">'), true);
  assert.equal(markup.includes('Manage mappings'), true);
  assert.equal(markup.includes('control-status-text'), true);
});

test('Utilities feature pages keep one header feature toggle and render mapping status as plain table text', () => {
  const snapshot = {
    features: [{ name: 'tickets', enabled: true, config: {} }],
    ticket_types: [],
    resources: [
      { key: 'ticket_panel', id: '10', name: 'tickets', exists: true, kind: 'text' },
      { key: 'ticket_category', id: null, name: null, exists: false, kind: null },
      { key: 'ticket_logs', id: '12', name: null, exists: false, kind: 'text' },
    ],
  };
  const markup = renderDefinition(createUtilitiesPageDefinition('/control/utilities/ticket-configuration'), snapshot);
  assert.equal(markup.includes('control-feature-header-actions'), true);
  assert.equal(markup.includes('aria-label=\"Tickets enabled\"'), false);
  assert.equal(markup.includes('type=\"checkbox\"'), false);
  assert.equal(markup.includes('data-utility-edit'), true);
  assert.equal(markup.includes('ticket-feature-heading'), false);
  assert.equal(markup.includes('<table class=\"control-summary-table utility-resource-table\">'), true);
  assert.equal(markup.includes('control-status-text'), true);
  assert.equal(markup.includes('Manage mapping'), true);
});

test('Analytics moves its editable feature toggle into the standard page header', () => {
  const snapshot = {
    features: [{ name: 'analytics', enabled: true, config: {} }],
    resources: [{ key: 'analytics', id: '20', name: 'analytics', exists: true, kind: 'text' }],
    analytics: null,
  };
  const definition = createAnalyticsPageDefinition();
  const store = createControlStateStore();
  store.register(definition);
  store.hydrate(definition.pageKey, snapshot, 'b'.repeat(64));
  const readMarkup = definition.render({ state: store.get(definition.pageKey), snapshot });
  assert.equal(readMarkup.includes('control-feature-header-actions'), true);
  assert.equal(readMarkup.includes('aria-label=\"Analytics enabled\"'), false);
  assert.equal(readMarkup.includes('data-analytics-enabled'), false);
  assert.equal(readMarkup.includes('data-analytics-edit'), true);
  store.beginEdit(definition.pageKey);
  const editMarkup = definition.render({ state: store.get(definition.pageKey), snapshot });
  assert.equal(editMarkup.includes('data-analytics-enabled'), true);
  assert.equal((editMarkup.match(/data-analytics-enabled/g) || []).length, 1);
  assert.equal(editMarkup.includes('>Edit settings<'), false);
  assert.equal(editMarkup.includes('Manage mappings'), true);
});
