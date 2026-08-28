import {
  controlState,
  registerControlPage,
  registeredControlPage,
} from './control-page-registry.js';

const CHANNEL_KEYS = Object.freeze([
  'moderation_log',
  'ticket_panel',
  'ticket_logs',
  'create_workspace_voice',
  'coworking_lounge',
  'announcements',
  'live_announcements',
  'role_panel',
  'ai_updates',
  'quiz_channel',
  'anon_questions',
  'analytics',
  'showcase_forum',
  'app_of_the_week',
  'collab_lfg',
]);
const ROLE_KEYS = Object.freeze([
  'live_ping_role',
  'builder_role',
  'contributor_role',
  'mentor_role',
]);
const CATEGORY_KEYS = Object.freeze([
  'ticket_category',
  'temp_voice_category',
]);

export const MAPPING_PAGE_CONFIGS = Object.freeze({
  '/control/mappings/channels': Object.freeze({
    title: 'Channels',
    group: 'channels',
    resourceKeys: CHANNEL_KEYS,
  }),
  '/control/mappings/roles': Object.freeze({
    title: 'Roles',
    group: 'roles',
    resourceKeys: ROLE_KEYS,
  }),
  '/control/mappings/categories': Object.freeze({
    title: 'Categories',
    group: 'categories',
    resourceKeys: CATEGORY_KEYS,
  }),
});

export const MAPPING_RESOURCE_DEFINITIONS = Object.freeze({
  moderation_log: Object.freeze({ label: 'Moderation log', group: 'channels', kind: 'text' }),
  ticket_panel: Object.freeze({ label: 'Ticket panel', group: 'channels', kind: 'text' }),
  ticket_logs: Object.freeze({ label: 'Ticket logs', group: 'channels', kind: 'text' }),
  create_workspace_voice: Object.freeze({ label: 'Create workspace voice', group: 'channels', kind: 'voice' }),
  coworking_lounge: Object.freeze({ label: 'Coworking lounge', group: 'channels', kind: 'voice' }),
  announcements: Object.freeze({ label: 'Announcements', group: 'channels', kind: 'text' }),
  live_announcements: Object.freeze({ label: 'Live announcements', group: 'channels', kind: 'text' }),
  role_panel: Object.freeze({ label: 'Role panel', group: 'channels', kind: 'text' }),
  ai_updates: Object.freeze({ label: 'AI updates', group: 'channels', kind: 'text' }),
  quiz_channel: Object.freeze({ label: 'Quiz channel', group: 'channels', kind: 'text' }),
  anon_questions: Object.freeze({ label: 'Anonymous questions', group: 'channels', kind: 'text' }),
  analytics: Object.freeze({ label: 'Analytics', group: 'channels', kind: 'text' }),
  showcase_forum: Object.freeze({ label: 'Showcase forum', group: 'channels', kind: 'forum' }),
  app_of_the_week: Object.freeze({ label: 'App of the week', group: 'channels', kind: 'text' }),
  collab_lfg: Object.freeze({ label: 'Collaboration / LFG', group: 'channels', kind: 'text' }),
  live_ping_role: Object.freeze({ label: 'Live ping role', group: 'roles', kind: 'role' }),
  builder_role: Object.freeze({ label: 'Builder role', group: 'roles', kind: 'role' }),
  contributor_role: Object.freeze({ label: 'Contributor role', group: 'roles', kind: 'role' }),
  mentor_role: Object.freeze({ label: 'Mentor role', group: 'roles', kind: 'role' }),
  ticket_category: Object.freeze({ label: 'Ticket category', group: 'categories', kind: 'category' }),
  temp_voice_category: Object.freeze({ label: 'Temporary voice category', group: 'categories', kind: 'category' }),
});

const suggestionReviewOpen = new Set();
const suggestionConfirmations = new Map();

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function optionLabel(item) {
  return item?.name || 'Unnamed Discord resource';
}

function kindLabel(kind) {
  if (kind === 'text') return 'text channel';
  if (kind === 'voice') return 'voice channel';
  if (kind === 'forum') return 'forum channel';
  if (kind === 'category') return 'category';
  if (kind === 'role') return 'role';
  return 'Discord resource';
}

function sortByName(items) {
  return [...items].sort((left, right) => {
    const byName = String(left.name || '').localeCompare(String(right.name || ''), undefined, {
      sensitivity: 'base',
    });
    if (byName !== 0) return byName;
    return String(left.id || '').localeCompare(String(right.id || ''));
  });
}

export function mappingOptionsForKey(snapshot, key) {
  const definition = MAPPING_RESOURCE_DEFINITIONS[key];
  if (!definition) return [];

  if (definition.kind === 'role') {
    const topRolePosition = Number(snapshot?.bot?.top_role_position || 0);
    return sortByName((snapshot?.roles || []).filter(role => (
      role
      && !role.managed
      && role.name !== '@everyone'
      && (!topRolePosition || Number(role.position || 0) < topRolePosition)
    )));
  }

  return sortByName((snapshot?.channels || []).filter(channel => channel?.kind === definition.kind));
}

function resourceRows(snapshot) {
  return new Map((snapshot?.resources || []).map(item => [item.key, item]));
}

export function createMappingPageDefinition(pageKey) {
  const config = MAPPING_PAGE_CONFIGS[pageKey];
  if (!config) throw new Error(`Unknown Mappings page: ${pageKey}`);

  let latestSnapshot = {};
  let persistedIds = {};

  return {
    pageKey,

    selectPersisted(snapshot) {
      latestSnapshot = snapshot || {};
      const byKey = resourceRows(snapshot);
      const persisted = {};
      persistedIds = {};
      for (const key of config.resourceKeys) {
        const row = byKey.get(key) || {
          key,
          id: null,
          name: null,
          exists: false,
          kind: null,
        };
        persisted[key] = {
          key,
          id: row.id == null ? null : String(row.id),
          name: row.name || null,
          exists: Boolean(row.exists),
          kind: row.kind || null,
        };
        persistedIds[key] = persisted[key].id;
      }
      return persisted;
    },

    cloneDraft(value) {
      const draft = {};
      for (const key of config.resourceKeys) {
        const raw = value?.[key];
        const selected = raw && typeof raw === 'object' ? raw.id : raw;
        draft[key] = selected == null || selected === '' ? null : String(selected);
      }
      return draft;
    },

    validateDraft(draft) {
      const errors = {};
      for (const key of config.resourceKeys) {
        const selected = draft?.[key] == null || draft?.[key] === '' ? null : String(draft[key]);
        if (selected === null || selected === persistedIds[key]) continue;
        const options = mappingOptionsForKey(latestSnapshot, key);
        if (!options.some(option => String(option.id) === selected)) {
          errors[key] = `${MAPPING_RESOURCE_DEFINITIONS[key].label} must use an available ${kindLabel(MAPPING_RESOURCE_DEFINITIONS[key].kind)}.`;
        }
      }
      return errors;
    },

    diffDraft(persisted, draft) {
      const changes = [];
      for (const key of config.resourceKeys) {
        const current = persisted?.[key]?.id == null ? null : String(persisted[key].id);
        const selected = draft?.[key] == null || draft?.[key] === '' ? null : String(draft[key]);
        if (current === selected) continue;
        if (selected === null) {
          changes.push({ action_type: 'clear_resource', payload: { key } });
        } else {
          changes.push({ action_type: 'set_resource', payload: { key, discord_id: selected } });
        }
      }
      return changes;
    },

    render({ state, snapshot } = {}) {
      return mappingPageMarkup({ pageKey, state, snapshot });
    },

    install({ root, store = controlState, snapshot, onSave, onApplySuggestions, rerender } = {}) {
      return installMappingPageInteractions({
        root,
        pageKey,
        store,
        snapshot,
        onSave,
        onApplySuggestions,
        rerender,
      });
    },
  };
}

export function registerMappingPages() {
  for (const pageKey of Object.keys(MAPPING_PAGE_CONFIGS)) {
    if (!registeredControlPage(pageKey)) registerControlPage(createMappingPageDefinition(pageKey));
  }
}

function healthFor(row) {
  if (row?.id && row.exists) return { label: 'Connected', className: 'good' };
  if (row?.id) return { label: 'Unavailable / stale', className: 'bad' };
  return { label: 'Not connected', className: 'neutral' };
}

function readRow(key, row) {
  const definition = MAPPING_RESOURCE_DEFINITIONS[key];
  const health = healthFor(row);
  const current = row?.id && row.exists
    ? (row.name || 'Connected Discord resource')
    : row?.id
      ? 'Previously connected resource is unavailable'
      : 'No resource connected';
  return `
    <article class="mapping-row" data-mapping-key="${escapeHtml(key)}">
      <div class="mapping-row-copy">
        <strong>${escapeHtml(definition.label)}</strong>
        <span class="mapping-current">${escapeHtml(current)}</span>
      </div>
      <span class="mapping-health" data-tone="${health.className}">${escapeHtml(health.label)}</span>
    </article>`;
}

function editRow(key, persisted, selected, snapshot, error) {
  const definition = MAPPING_RESOURCE_DEFINITIONS[key];
  const options = mappingOptionsForKey(snapshot, key);
  const selectedId = selected == null ? '' : String(selected);
  const staleSelected = Boolean(
    selectedId
    && persisted?.id === selectedId
    && !options.some(option => String(option.id) === selectedId),
  );
  const optionMarkup = options.map(option => (
    `<option value="${escapeHtml(option.id)}"${String(option.id) === selectedId ? ' selected' : ''}>${escapeHtml(optionLabel(option))}</option>`
  )).join('');
  return `
    <div class="mapping-editor-row" data-mapping-key="${escapeHtml(key)}">
      <label for="mapping-${escapeHtml(key)}">${escapeHtml(definition.label)}</label>
      <select id="mapping-${escapeHtml(key)}" data-mapping-key="${escapeHtml(key)}" aria-describedby="mapping-${escapeHtml(key)}-help${error ? ` mapping-${escapeHtml(key)}-error` : ''}">
        <option value=""${selectedId === '' ? ' selected' : ''}>Not connected</option>
        ${staleSelected ? `<option value="${escapeHtml(selectedId)}" disabled selected>Unavailable current mapping</option>` : ''}
        ${optionMarkup}
      </select>
      <span class="mapping-field-help" id="mapping-${escapeHtml(key)}-help">Choose an available ${escapeHtml(kindLabel(definition.kind))}.</span>
      ${error ? `<span class="mapping-field-error" id="mapping-${escapeHtml(key)}-error" role="alert">${escapeHtml(error)}</span>` : ''}
    </div>`;
}

export function mappingSuggestionGroups(snapshot) {
  const groups = { channels: [], roles: [], categories: [] };
  for (const item of snapshot?.mappings_review?.proposed || []) {
    const definition = MAPPING_RESOURCE_DEFINITIONS[item?.key];
    if (!definition || !groups[definition.group]) continue;
    groups[definition.group].push({ ...item, group: definition.group });
  }
  return groups;
}

function approvedProposals(snapshot) {
  return (snapshot?.mappings_review?.proposed || []).filter(item => Boolean(MAPPING_RESOURCE_DEFINITIONS[item?.key]));
}

export function mappingSuggestionApplyPayload(snapshot, confirmedKeys = new Set()) {
  const review = snapshot?.mappings_review || {};
  const proposed = approvedProposals(snapshot);
  return {
    plan_hash: String(review.plan_hash || ''),
    items: proposed.map(item => ({
      key: item.key,
      action: item.action,
      target_id: item.target?.id == null ? null : String(item.target.id),
    })),
    confirmed_keys: proposed
      .filter(item => item.requires_confirmation && confirmedKeys.has(item.key))
      .map(item => item.key),
  };
}

function suggestionConsequence(item) {
  if (item.action === 'create') {
    return `Create ${kindLabel(item.kind)} “${item.canonical_name}” and connect it.`;
  }
  if (item.action === 'remap') {
    const from = item.current?.name || 'the current resource';
    const to = item.target?.name || item.canonical_name;
    return `Replace ${from} with ${to}.`;
  }
  const target = item.target?.name || item.canonical_name;
  return `Connect ${item.canonical_name} to ${target}.`;
}

function suggestionMarkup(pageKey, snapshot) {
  const review = snapshot?.mappings_review || { quiet: true, proposed: [] };
  const quiet = Boolean(review.quiet || !approvedProposals(snapshot).length);
  const open = suggestionReviewOpen.has(pageKey);
  const confirmations = suggestionConfirmations.get(pageKey) || new Set();
  const groups = mappingSuggestionGroups(snapshot);
  const required = approvedProposals(snapshot).filter(item => item.requires_confirmation);
  const allConfirmed = required.every(item => confirmations.has(item.key));

  let reviewMarkup = '';
  if (open) {
    const sections = [
      ['channels', 'Channels'],
      ['roles', 'Roles'],
      ['categories', 'Categories'],
    ].map(([group, label]) => {
      const items = groups[group];
      if (!items.length) return '';
      return `
        <section class="mapping-suggestion-group">
          <h3>${label}</h3>
          ${items.map(item => `
            <div class="mapping-suggestion-item">
              <div>
                <strong>${escapeHtml(MAPPING_RESOURCE_DEFINITIONS[item.key].label)}</strong>
                <p>${escapeHtml(suggestionConsequence(item))}</p>
              </div>
              ${item.requires_confirmation ? `
                <label class="mapping-confirmation">
                  <input type="checkbox" data-mapping-confirm-key="${escapeHtml(item.key)}"${confirmations.has(item.key) ? ' checked' : ''}>
                  Confirm this ${item.action === 'create' ? 'creation' : 'replacement'}
                </label>` : '<span class="mapping-review-only">Review only</span>'}
            </div>`).join('')}
        </section>`;
    }).join('');

    reviewMarkup = quiet
      ? '<p class="mapping-suggestion-empty">No mapping changes are suggested right now.</p>'
      : `${sections}
        <div class="mapping-suggestion-actions">
          <button class="control-button control-button-primary" type="button" data-mapping-apply-suggestions${allConfirmed ? '' : ' disabled'}>Apply reviewed mappings</button>
        </div>`;
  }

  return `
    <section class="mapping-suggestions" data-suggestions-quiet="${String(quiet)}">
      <div class="mapping-suggestions-heading">
        <div>
          <h2>Suggested mappings</h2>
          <p>Review only the resources owned by Mappings. Nothing is changed until you apply the reviewed plan.</p>
        </div>
        <button class="control-button control-button-secondary" type="button" data-mapping-review>${open ? 'Close review' : 'Review suggested mappings'}</button>
      </div>
      ${reviewMarkup}
    </section>`;
}

export function mappingPageMarkup({ pageKey, state, snapshot } = {}) {
  const config = MAPPING_PAGE_CONFIGS[pageKey];
  if (!config) return '';
  if (!state?.persisted) {
    return `<section class="control-page mapping-page"><h1>${escapeHtml(config.title)}</h1><p>Load current server state to manage these mappings.</p></section>`;
  }

  const statusMarkup = state.saveError
    ? `<p class="mapping-page-message" role="alert">${escapeHtml(state.saveError)}</p>`
    : state.status === 'conflict'
      ? '<p class="mapping-page-message" role="alert">Server state changed while you were editing. Review your draft before retrying.</p>'
      : '';

  if (state.mode === 'edit') {
    return `
      <section class="control-page mapping-page" data-page-key="${escapeHtml(pageKey)}">
        <header class="mapping-page-header">
          <div><h1>${escapeHtml(config.title)}</h1><p>Choose current Discord resources, then save all changes together.</p></div>
        </header>
        ${statusMarkup}
        <div class="mapping-edit-grid">
          ${config.resourceKeys.map(key => editRow(key, state.persisted[key], state.draft[key], snapshot, state.errors?.[key])).join('')}
        </div>
        <div class="mapping-page-actions">
          <button class="control-button control-button-primary" type="button" data-mapping-save${state.dirty && !Object.keys(state.errors || {}).length && state.status !== 'saving' ? '' : ' disabled'}>${state.status === 'saving' ? 'Saving…' : 'Save changes'}</button>
          <button class="control-button control-button-secondary" type="button" data-mapping-discard${state.status === 'saving' ? ' disabled' : ''}>Discard</button>
        </div>
        ${suggestionMarkup(pageKey, snapshot)}
      </section>`;
  }

  return `
    <section class="control-page mapping-page" data-page-key="${escapeHtml(pageKey)}">
      <header class="mapping-page-header">
        <div><h1>${escapeHtml(config.title)}</h1><p>Current Discord resources and their connection health.</p></div>
        <button class="control-button control-button-primary" type="button" data-mapping-edit>Edit settings</button>
      </header>
      ${statusMarkup}
      <div class="mapping-read-list">
        ${config.resourceKeys.map(key => readRow(key, state.persisted[key])).join('')}
      </div>
      ${suggestionMarkup(pageKey, snapshot)}
    </section>`;
}

export function installMappingPageInteractions({
  root,
  pageKey,
  store = controlState,
  snapshot,
  onSave,
  onApplySuggestions,
  rerender = () => {},
} = {}) {
  if (!root?.addEventListener) return () => {};

  const onClick = event => {
    const edit = event.target?.closest?.('[data-mapping-edit]');
    if (edit) {
      store.beginEdit(pageKey);
      rerender();
      return;
    }

    const save = event.target?.closest?.('[data-mapping-save]');
    if (save) {
      if (store.canSave(pageKey)) onSave?.(pageKey, store.buildSaveRequest(pageKey));
      return;
    }

    const discard = event.target?.closest?.('[data-mapping-discard]');
    if (discard) {
      store.discard(pageKey);
      store.get(pageKey).mode = 'read';
      rerender();
      return;
    }

    const review = event.target?.closest?.('[data-mapping-review]');
    if (review) {
      if (suggestionReviewOpen.has(pageKey)) {
        suggestionReviewOpen.delete(pageKey);
      } else {
        suggestionReviewOpen.add(pageKey);
      }
      rerender();
      return;
    }

    const apply = event.target?.closest?.('[data-mapping-apply-suggestions]');
    if (apply) {
      const confirmations = suggestionConfirmations.get(pageKey) || new Set();
      onApplySuggestions?.(mappingSuggestionApplyPayload(snapshot, confirmations));
    }
  };

  const onChange = event => {
    const field = event.target?.closest?.('[data-mapping-key]');
    if (field?.dataset?.mappingKey && field.tagName !== 'ARTICLE') {
      const key = field.dataset.mappingKey;
      if (MAPPING_RESOURCE_DEFINITIONS[key] && MAPPING_PAGE_CONFIGS[pageKey].resourceKeys.includes(key)) {
        store.updateDraft(pageKey, draft => {
          draft[key] = field.value === '' ? null : String(field.value);
        });
        rerender();
        return;
      }
    }

    const confirmation = event.target?.closest?.('[data-mapping-confirm-key]');
    if (confirmation?.dataset?.mappingConfirmKey) {
      const key = confirmation.dataset.mappingConfirmKey;
      const confirmations = new Set(suggestionConfirmations.get(pageKey) || []);
      if (confirmation.checked) confirmations.add(key);
      else confirmations.delete(key);
      suggestionConfirmations.set(pageKey, confirmations);
      rerender();
    }
  };

  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('change', onChange);
  };
}
