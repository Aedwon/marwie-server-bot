from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[3]


def read(path):
    return (ROOT / path).read_text()


def write(path, text):
    (ROOT / path).write_text(text)


def add_resource_imports(source):
    if "./control-resource-bindings.js" in source:
        return source
    marker = "import { featureHeaderActionsMarkup } from './control-components.js';\n"
    assert marker in source
    return source.replace(
        marker,
        marker
        + "import { featureResourceKeys } from './control-resource-contract.js';\n"
        + "import { withResourceBindings } from './control-resource-bindings.js';\n",
        1,
    )


def clean_mapping_detours(source):
    source = re.sub(r"Mappings owns these resource connections\. They are read-only here\.", "Discord resources are available in Context.", source, flags=re.I)
    source = re.sub(r"\bstays in Mappings\b", "is configured in Context", source, flags=re.I)
    source = re.sub(r"\bstay in Mappings\b", "are configured in Context", source, flags=re.I)
    source = re.sub(r"Manage mappings", "Resource details", source, flags=re.I)
    return source


# Community
path = 'docs-site/control-community.js'
s = add_resource_imports(read(path))
s = s.replace(
    'registerControlPage(createCommunityPageDefinition(pageKey))',
    'registerControlPage(withResourceBindings(createCommunityPageDefinition(pageKey), featureResourceKeys(pageKey)))',
)
s = clean_mapping_detours(s)
marker = 'function mappingSummary(snapshot, groups) {'
assert marker in s
if marker + "\n  return '';" not in s:
    s = s.replace(marker, marker + "\n  return '';", 1)
write(path, s)

# Content
path = 'docs-site/control-content.js'
s = add_resource_imports(read(path))
s = s.replace(
    'registerControlPage(createContentPageDefinition(pageKey))',
    'registerControlPage(withResourceBindings(createContentPageDefinition(pageKey), featureResourceKeys(pageKey)))',
)
s = clean_mapping_detours(s)
write(path, s)

# Utilities
path = 'docs-site/control-utilities.js'
s = add_resource_imports(read(path))
s = s.replace(
    'registerControlPage(createUtilitiesPageDefinition(pageKey))',
    'registerControlPage(withResourceBindings(createUtilitiesPageDefinition(pageKey), featureResourceKeys(pageKey)))',
)
s = s.replace("title: 'Ticket configuration'", "title: 'Tickets'", 1)
s = s.replace("description: 'Manage the ticket feature and ticket types.'", "description: 'Manage ticket intake and ticket types.'", 1)
s = clean_mapping_detours(s)
marker = 'function resourceSummaryMarkup(snapshot, items, manageHref = \'/control/mappings/channels\') {'
assert marker in s
if marker + "\n  return '';" not in s:
    s = s.replace(marker, marker + "\n  return '';", 1)
write(path, s)

# Analytics
path = 'docs-site/control-analytics.js'
s = add_resource_imports(read(path))
s = s.replace(
    'registerControlPage(createAnalyticsPageDefinition())',
    'registerControlPage(withResourceBindings(createAnalyticsPageDefinition(), featureResourceKeys(ANALYTICS_PAGE_KEY)))',
)
s = clean_mapping_detours(s)
write(path, s)

# Server-side page-save ownership now accepts canonical feature-local resource changes.
path = 'api/_lib/page-save.js'
s = read(path)
if "control-resource-contract.js" not in s:
    s = "import { featureOwnsResource } from '../../docs-site/control-resource-contract.js';\n\n" + s
feature_pages = [
    '/control/community/reputation',
    '/control/community/quizzes',
    '/control/community/voice-coworking',
    '/control/community/showcase',
    '/control/content/feeds',
    '/control/content/announcements',
    '/control/content/live',
    '/control/utilities/ticket-configuration',
    '/control/utilities/notification-roles',
    '/control/utilities/anonymous-questions',
    '/control/analytics',
    '/control/workflows/moderation',
]
for page in feature_pages:
    pattern = re.compile(r"('" + re.escape(page) + r"': Object\.freeze\(\[)([^\]]*)(\]\),)")
    match = pattern.search(s)
    assert match, page
    body = match.group(2)
    if "'set_resource'" not in body:
        body = body.rstrip()
        if body and not body.endswith(','):
            body += ', '
        body += "'set_resource', 'clear_resource'"
        s = s[:match.start()] + match.group(1) + body + match.group(3) + s[match.end():]
old = """  if (actionType === 'set_resource' || actionType === 'clear_resource') {
    const key = String(payload.key || '');
    const expected = pageKey === '/control/mappings/roles'
      ? ROLE_RESOURCE_KEYS
      : pageKey === '/control/mappings/categories'
        ? CATEGORY_RESOURCE_KEYS
        : CHANNEL_RESOURCE_KEYS;
    if (!expected.has(key)) {
      throw new HttpError(400, 'That Discord mapping is not owned by this Mappings page.');
    }
  }"""
new = """  if (actionType === 'set_resource' || actionType === 'clear_resource') {
    const key = String(payload.key || '');
    if (pageKey.startsWith('/control/mappings/')) {
      const expected = pageKey === '/control/mappings/roles'
        ? ROLE_RESOURCE_KEYS
        : pageKey === '/control/mappings/categories'
          ? CATEGORY_RESOURCE_KEYS
          : CHANNEL_RESOURCE_KEYS;
      if (!expected.has(key)) {
        throw new HttpError(400, 'That Discord resource is not owned by this Resources page.');
      }
    } else if (!featureOwnsResource(pageKey, key)) {
      throw new HttpError(400, 'That Discord resource is owned by a different Control page.');
    }
  }"""
assert old in s
s = s.replace(old, new, 1)
write(path, s)

# Moderation becomes the Support & Safety feature page; the two remaining workflow routes stay playbooks.
path = 'docs-site/control-workflows.js'
s = read(path)
if "control-resource-bindings.js" not in s:
    s = (
        "import { registerControlPage, registeredControlPage } from './control-page-registry.js';\n"
        "import { featureResourceKeys } from './control-resource-contract.js';\n"
        "import { withResourceBindings } from './control-resource-bindings.js';\n\n"
        + s
    )
s = clean_mapping_detours(s)
append_marker = '// Control redesign completion: Moderation is configurable; other workflows remain guidance-only.'
if append_marker not in s:
    s += r'''

// Control redesign completion: Moderation is configurable; other workflows remain guidance-only.
const MODERATION_PAGE = '/control/workflows/moderation';

function moderationEnabled(snapshot) {
  return Boolean((snapshot?.features || []).find(item => item?.name === 'moderation')?.enabled);
}

function createModerationPageDefinition() {
  return {
    pageKey: MODERATION_PAGE,
    selectPersisted(snapshot) {
      return { enabled: moderationEnabled(snapshot) };
    },
    cloneDraft(value) {
      return { enabled: Boolean(value?.enabled) };
    },
    validateDraft() {
      return {};
    },
    diffDraft(persisted, draft) {
      if (Boolean(persisted?.enabled) === Boolean(draft?.enabled)) return [];
      return [{ action_type: 'set_feature', payload: { feature: 'moderation', enabled: Boolean(draft?.enabled) } }];
    },
    render({ state } = {}) {
      const base = workflowPageMarkup(MODERATION_PAGE);
      if (!state?.persisted) return base;
      const enabled = state.mode === 'edit' ? state.draft.enabled : state.persisted.enabled;
      const controls = state.mode === 'edit'
        ? `<section class="workflow-feature-settings"><label><span><strong>Moderation</strong><small>Enable Rob-bot moderation actions for this server.</small></span><input type="checkbox" data-workflow-enabled${enabled ? ' checked' : ''}></label><div><button class="control-button control-button-primary" type="button" data-workflow-save${state.dirty && !Object.keys(state.errors || {}).length && state.status !== 'saving' ? '' : ' disabled'}>${state.status === 'saving' ? 'Saving…' : 'Save changes'}</button><button class="control-button control-button-secondary" type="button" data-workflow-discard${state.status === 'saving' ? ' disabled' : ''}>Discard</button></div></section>`
        : `<div class="workflow-feature-state"><span>${enabled ? 'Enabled' : 'Disabled'}</span><button class="control-button control-button-secondary" type="button" data-workflow-edit>Edit settings</button></div>`;
      return base.replace('</header>', `</header>${controls}`);
    },
    install({ root, store, pageKey, onSave, rerender } = {}) {
      const onClick = event => {
        if (event.target.closest?.('[data-workflow-edit]')) {
          store.beginEdit(pageKey);
          rerender?.();
          return;
        }
        if (event.target.closest?.('[data-workflow-discard]')) {
          store.discard(pageKey);
          rerender?.();
          return;
        }
        if (event.target.closest?.('[data-workflow-save]') && store.canSave(pageKey)) {
          onSave?.(pageKey, store.buildSaveRequest(pageKey));
        }
      };
      const onChange = event => {
        const toggle = event.target.closest?.('[data-workflow-enabled]');
        if (!toggle) return;
        store.updateDraft(pageKey, draft => { draft.enabled = Boolean(toggle.checked); });
        rerender?.();
      };
      root.addEventListener('click', onClick);
      root.addEventListener('change', onChange);
      return () => {
        root.removeEventListener('click', onClick);
        root.removeEventListener('change', onChange);
      };
    },
  };
}

export function registerWorkflowPages() {
  if (!registeredControlPage(MODERATION_PAGE)) {
    registerControlPage(withResourceBindings(
      createModerationPageDefinition(),
      featureResourceKeys(MODERATION_PAGE),
    ));
  }
}
'''
write(path, s)

# Wire moderation registration into the shell.
path = 'docs-site/control-app.js'
s = read(path)
s = s.replace(
    "import { workflowPageMarkup } from './control-workflows.js';",
    "import { registerWorkflowPages, workflowPageMarkup } from './control-workflows.js';",
)
if 'registerWorkflowPages();' not in s:
    s = s.replace('registerAnalyticsPage();\nregisterMappingPages();', 'registerAnalyticsPage();\nregisterWorkflowPages();\nregisterMappingPages();')
write(path, s)

# Flatten legacy mapping-summary surfaces; canonical resources now live in Context.
path = 'docs-site/control.css'
s = read(path)
marker = '/* Completion context and route cleanup */'
if marker not in s:
    s += r'''

/* Completion context and route cleanup */
.community-mappings,
.content-mappings,
.content-mapping-section,
.utility-mapping-section,
.analytics-channel-summary,
.analytics-mapping-section {
  display: none !important;
}

.control-context-section { display: grid; gap: 12px; }
.control-context-section h2 { margin: 0; font-size: 16px; line-height: 1.25; font-weight: 600; }
.control-context-section > p { margin: -4px 0 2px; color: var(--text-secondary); font-size: 13px; line-height: 1.45; }
.control-resource-row { display: grid; gap: 6px; padding: 11px 0; border-bottom: 1px solid var(--stroke-subtle); }
.control-resource-row:last-child { border-bottom: 0; }
.control-resource-row > div { display: grid; gap: 2px; min-width: 0; }
.control-resource-row strong { font-size: 14px; line-height: 1.3; font-weight: 500; }
.control-resource-row small { color: var(--text-secondary); font-size: 13px; line-height: 1.35; overflow-wrap: anywhere; }
.control-resource-status { justify-self: start; color: var(--text-secondary); font-size: 13px; line-height: 1.3; }
.control-resource-status[data-tone="good"] { color: var(--status-success-fg); }
.control-resource-status[data-tone="bad"] { color: var(--status-error-fg); }
.control-resource-status[data-tone="info"] { color: var(--status-info-fg); }
.control-resource-field { display: grid; gap: 7px; }
.control-resource-field > span { font-size: 13px; line-height: 1.3; font-weight: 500; }
.control-resource-field select { width: 100%; min-height: 38px; }
.control-resource-confirm { display: grid; grid-template-columns: auto 1fr; gap: 8px; align-items: start; color: var(--text-secondary); font-size: 13px; line-height: 1.4; }
.control-resource-error { color: var(--status-error-fg); font-size: 13px; line-height: 1.4; }
.workflow-feature-settings { display: grid; gap: 14px; margin: 18px 0 28px; padding: 16px 0; border-block: 1px solid var(--stroke-subtle); }
.workflow-feature-settings > label { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.workflow-feature-settings > label > span { display: grid; gap: 3px; }
.workflow-feature-settings small { color: var(--text-secondary); font-size: 13px; line-height: 1.4; }
.workflow-feature-settings > div { display: flex; gap: 8px; justify-content: flex-end; }
.workflow-feature-state { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 16px 0 28px; padding-block: 12px; border-block: 1px solid var(--stroke-subtle); }
'''
write(path, s)

print('feature completion transform applied')
