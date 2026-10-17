from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def exact(path, old, new):
    p = ROOT / path
    source = p.read_text()
    assert old in source, (path, old[:80])
    p.write_text(source.replace(old, new, 1))


# Wave 11 prohibited labels were written before System and Publishing became approved groups.
exact(
    'web-tests/control-cleanup-wave11.test.js',
    '/overview|features|setup|settings|system|advanced|publishing|build-help|message-logs/',
    '/overview|features|setup|settings|advanced|build-help|message-logs/',
)

# System is now the explicit default appearance.
p = ROOT / 'web-tests/control-foundation-regressions.test.js'
s = p.read_text()
s = s.replace(
    "test('appearance defaults to Dark and resolves Dark, Light and System correctly'",
    "test('appearance defaults to System and resolves Dark, Light and System correctly'",
)
s = s.replace(
    """    resolveThemePreference(null, false),
    { preference: 'dark', theme: 'dark' },
  );
  assert.deepEqual(
    resolveThemePreference(null, true),
    { preference: 'dark', theme: 'dark' },""",
    """    resolveThemePreference(null, false),
    { preference: 'system', theme: 'light' },
  );
  assert.deepEqual(
    resolveThemePreference(null, true),
    { preference: 'system', theme: 'dark' },""",
    1,
)
s = s.replace(
    """  assert.equal(root.dataset.preference, 'dark');
  assert.equal(root.dataset.theme, 'dark');
  assert.equal(dark.getAttribute('aria-pressed'), 'true');""",
    """  assert.equal(root.dataset.preference, 'system');
  assert.equal(root.dataset.theme, 'light');
  assert.equal(system.getAttribute('aria-pressed'), 'true');""",
    1,
)
s = s.replace(
    r'''/<html[^>]*data-theme=["']dark["'][^>]*data-preference=["']dark["']/''',
    r'''/<html[^>]*data-theme=["']light["'][^>]*data-preference=["']system["']/''',
)
s = s.replace(
    r'''/localStorage\.getItem\(['"]rob-doc-theme['"]\)\s*\|\|\s*['"]dark['"]/''',
    r'''/localStorage\.getItem\(['"]rob-doc-theme['"]\)\s*\|\|\s*['"]system['"]/''',
)
p.write_text(s)

# Moderation now owns configuration; Ticket handling and Events remain playbooks.
p = ROOT / 'web-tests/control-stage3-reconciliation.test.js'
s = p.read_text()
s = s.replace(
    "test('Analytics and Workflows preserve final Stage 3 presentation ownership'",
    "test('Analytics and Support & Safety preserve final presentation ownership'",
)
s = s.replace(
    """  assert.equal(workflows.includes('<button'), false);
  assert.equal(workflows.includes('data-control-field'), false);""",
    """  assert.match(workflows, /registerWorkflowPages/);
  assert.match(workflows, /createModerationPageDefinition/);
  assert.match(workflows, /ticket-handling/);
  assert.match(workflows, /events/);
  assert.equal(workflows.includes('data-control-field'), false);""",
)
p.write_text(s)

# Resource Context replaces inline Classic mapping summaries.
(ROOT / 'web-tests/control-uiux-domain-adoption.test.js').write_text(r'''import assert from 'node:assert/strict';
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
  assert.match(view.context, /Analytics/);
  view.store.beginEdit(view.wrapped.pageKey);
  const state = view.store.get(view.wrapped.pageKey);
  const editMarkup = view.wrapped.render({ state, snapshot });
  assert.match(editMarkup, /data-analytics-enabled/);
  assert.equal((editMarkup.match(/data-analytics-enabled/g) || []).length, 1);
});
''')

# Voice behavior stays feature-local while three Discord bindings move to Context.
p = ROOT / 'web-tests/control-community.test.js'
s = p.read_text()
a = s.index("test('Voice & Coworking exposes only Temporary voice and preserves coworking outside this page'")
b = s.index("test('Showcase exposes only feature-local state and Mappings summary'", a)
new = r'''test('Voice & Coworking owns Temporary voice behavior and exposes canonical voice resources through Context', async () => {
  const { createCommunityPageDefinition } = await communityModule();
  const { withResourceBindings } = await import('../docs-site/control-resource-bindings.js');
  const { featureResourceKeys } = await import('../docs-site/control-resource-contract.js');
  const definition = withResourceBindings(
    createCommunityPageDefinition(VOICE_COWORKING),
    featureResourceKeys(VOICE_COWORKING),
  );
  const snapshot = {
    features: [feature('voice', true), feature('coworking', false)],
    channels: [
      { id: '1', name: 'Create Workspace', type: 2 },
      { id: '3', name: 'Lounge', type: 2 },
    ],
    categories: [{ id: '2', name: 'Temporary voice', type: 4 }],
    resources: [
      { key: 'create_workspace_voice', id: '1', name: 'Create Workspace', exists: true, kind: 'voice' },
      { key: 'temp_voice_category', id: '2', name: 'Temporary voice', exists: true, kind: 'category' },
      { key: 'coworking_lounge', id: '3', name: 'Lounge', exists: true, kind: 'voice' },
    ],
  };
  const persisted = definition.selectPersisted(snapshot);
  assert.equal(persisted.voiceEnabled, true);
  assert.deepEqual(persisted.resourceBindings, {
    create_workspace_voice: '1',
    coworking_lounge: '3',
    temp_voice_category: '2',
  });
  const draft = definition.cloneDraft(persisted);
  draft.voiceEnabled = false;
  assert.deepEqual(definition.diffDraft(persisted, draft), [
    { action_type: 'set_feature', payload: { feature: 'voice', enabled: false } },
  ]);

  const state = { mode: 'read', status: 'clean', persisted, draft, errors: {}, dirty: false, saveError: null };
  const markup = definition.render({ state, snapshot });
  const context = definition.renderContext({ state, snapshot });
  assert.match(markup, /Temporary voice/);
  assert.doesNotMatch(markup, /Temporary voice category|coworking_lounge|create_workspace_voice/);
  assert.match(context, /Temporary voice category/);
  assert.match(context, /Create workspace voice/i);
  assert.match(context, /Coworking lounge/i);
});

'''
s = s[:a] + new + s[b:]
p.write_text(s)

# Fix the sole sub-13px rule introduced by the Playbooks label.
p = ROOT / 'docs-site/control.css'
s = p.read_text()
assert 'font-size: 12px;' in s
p.write_text(s.replace('font-size: 12px;', 'font-size: 13px;', 1))

print('superseded contracts updated')
