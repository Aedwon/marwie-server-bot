import assert from 'node:assert/strict';
import test from 'node:test';

import { createControlStateStore } from '../docs-site/control-state.js';
import { createCommunityPageDefinition } from '../docs-site/control-community.js';
import { createUtilitiesPageDefinition } from '../docs-site/control-utilities.js';
import { createAnalyticsPageDefinition } from '../docs-site/control-analytics.js';
import { featureResourceKeys } from '../docs-site/control-resource-contract.js';
import { withResourceBindings } from '../docs-site/control-resource-bindings.js';

function renderFeature(definition, snapshot) {
  const wrapped = withResourceBindings(definition, featureResourceKeys(definition.pageKey));
  const store = createControlStateStore();
  store.register(wrapped);
  store.hydrate(wrapped.pageKey, snapshot, 'a'.repeat(64));
  const state = store.get(wrapped.pageKey);
  return {
    wrapped,
    store,
    state,
    center: wrapped.render({ state, snapshot }),
    context: wrapped.renderContext({ state, snapshot }),
  };
}

test('Community keeps feature configuration in center and canonical resources in Context', () => {
  const snapshot = {
    features: [{ name: 'reputation', enabled: true, config: {} }],
    reputation: { thresholds: { builder: 50, contributor: 150, mentor: 500 } },
    roles: [
      { id: '1', name: 'Builder', managed: false, position: 1 },
      { id: '2', name: 'Contributor', managed: false, position: 2 },
      { id: '3', name: 'Mentor', managed: false, position: 3 },
    ],
    bot: { top_role_position: 10 },
    resources: [
      { key: 'builder_role', id: '1', name: 'Builder', exists: true, kind: 'role' },
      { key: 'contributor_role', id: '2', name: 'Contributor', exists: true, kind: 'role' },
      { key: 'mentor_role', id: '3', name: 'Mentor', exists: true, kind: 'role' },
    ],
  };
  const view = renderFeature(createCommunityPageDefinition('/control/community/reputation'), snapshot);
  assert.match(view.center, /control-feature-header-actions/);
  assert.doesNotMatch(view.center, /control-summary-table|Manage mappings/);
  assert.match(view.context, /Discord resources/);
  assert.match(view.context, /Builder role/);
  assert.match(view.context, /Contributor role/);
  assert.match(view.context, /Mentor role/);
});

test('Utilities keep feature settings in center and ticket resources in Context', () => {
  const snapshot = {
    features: [{ name: 'tickets', enabled: true, config: {} }],
    ticket_types: [],
    channels: [
      { id: '10', name: 'tickets', type: 0 },
      { id: '12', name: 'ticket-logs', type: 0 },
    ],
    categories: [{ id: '20', name: 'Tickets', type: 4 }],
    resources: [
      { key: 'ticket_panel', id: '10', name: 'tickets', exists: true, kind: 'text' },
      { key: 'ticket_logs', id: '12', name: 'ticket-logs', exists: true, kind: 'text' },
      { key: 'ticket_category', id: '20', name: 'Tickets', exists: true, kind: 'category' },
    ],
  };
  const view = renderFeature(createUtilitiesPageDefinition('/control/utilities/ticket-configuration'), snapshot);
  assert.match(view.center, /control-feature-header-actions/);
  assert.doesNotMatch(view.center, /utility-resource-table|Manage mapping/);
  assert.match(view.context, /Ticket panel/);
  assert.match(view.context, /Ticket logs/);
  assert.match(view.context, /Ticket category/);
});

test('Analytics keeps its feature toggle in the header and report destination in Context', () => {
  const snapshot = {
    features: [{ name: 'analytics', enabled: true, config: {} }],
    channels: [{ id: '20', name: 'analytics', type: 0 }],
    resources: [{ key: 'analytics', id: '20', name: 'analytics', exists: true, kind: 'text' }],
    analytics: null,
  };
  const view = renderFeature(createAnalyticsPageDefinition(), snapshot);
  assert.match(view.center, /control-feature-header-actions/);
  assert.doesNotMatch(view.center, /Manage mappings/);
  assert.match(view.context, /Report destination/);
  view.store.beginEdit(view.wrapped.pageKey);
  const state = view.store.get(view.wrapped.pageKey);
  const editMarkup = view.wrapped.render({ state, snapshot });
  assert.match(editMarkup, /data-analytics-enabled/);
  assert.equal((editMarkup.match(/data-analytics-enabled/g) || []).length, 1);
});
