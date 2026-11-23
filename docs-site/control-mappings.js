import {
  controlState,
  registerControlPage,
  registeredControlPage,
} from './control-page-registry.js';
import { controlPageHeaderMarkup, problemLine } from './control-components.js?v=24';
import { resourceSelectMarkup } from './control-resource-bindings.js?v=2';
import { problemsFromSnapshot } from './control-problems.js?v=1';
import { animateSegmentedThumbs, segmentedControlMarkup, stagedSaveBarMarkup } from './control-page-parts.js';

const COMPROMISED_ACCOUNT_TRAP_KEY = 'compromised_account_trap';
const CHANNEL_KEYS = Object.freeze([
  'moderation_log',
  COMPROMISED_ACCOUNT_TRAP_KEY,
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
  'anon_messages_panel',
  'anon_messages_submissions',
  'anon_messages_audit_log',
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
  compromised_account_trap: Object.freeze({
    label: 'Compromised account trap',
    group: 'channels',
    kind: 'text',
    manualOnly: true,
    destructive: true,
    warning: 'Any human who sends a new message in this channel will trigger automatic compromised-account enforcement.',
  }),
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
  anon_messages_panel: Object.freeze({ label: 'Anonymous message panel', group: 'channels', kind: 'text' }),
  anon_messages_submissions: Object.freeze({ label: 'Anonymous submissions', group: 'channels', kind: 'text' }),
  anon_messages_audit_log: Object.freeze({ label: 'Anonymous audit log', group: 'channels', kind: 'text' }),
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
const suggestionOperations = new Map();
const destructiveMappingConfirmations = new Map();

function mappingId(value) {
  const raw = value && typeof value === 'object' ? value.id : value;
  return raw == null || raw === '' ? null : String(raw);
}

export function requiresDestructiveMappingConfirmation(persisted, draft) {
  const current = mappingId(persisted?.[COMPROMISED_ACCOUNT_TRAP_KEY]);
  const selected = mappingId(draft?.[COMPROMISED_ACCOUNT_TRAP_KEY]);
  return selected !== null && selected !== current;
}

function destructiveConfirmationStateFor(pageKey, persisted, draft) {
  const selectedId = mappingId(draft?.[COMPROMISED_ACCOUNT_TRAP_KEY]);
  const required = requiresDestructiveMappingConfirmation(persisted, draft);
  const existing = destructiveMappingConfirmations.get(pageKey);

  if (!required) {
    const fresh = { selectedId, acknowledged: false, required: false };
    destructiveMappingConfirmations.set(pageKey, fresh);
    return fresh;
  }

  if (existing?.selectedId === selectedId) {
    return { ...existing, required: true };
  }

  const fresh = { selectedId, acknowledged: false, required: true };
  destructiveMappingConfirmations.set(pageKey, fresh);
  return fresh;
}

function reviewPlanHash(snapshot) {
  return String(snapshot?.mappings_review?.plan_hash || '');
}

function confirmationStateFor(pageKey, snapshot) {
  const planHash = reviewPlanHash(snapshot);
  const existing = suggestionConfirmations.get(pageKey);
  if (existing?.planHash === planHash) return existing;

  const fresh = { planHash, confirmedKeys: new Set() };
  suggestionConfirmations.set(pageKey, fresh);
  return fresh;
}

function operationStateFor(pageKey, snapshot) {
  const planHash = reviewPlanHash(snapshot);
  const existing = suggestionOperations.get(pageKey);
  if (existing?.planHash === planHash) return existing;

  const fresh = { planHash, status: 'idle', message: '' };
  suggestionOperations.set(pageKey, fresh);
  return fresh;
}

function setOperationState(pageKey, snapshot, status, message = '') {
  const state = {
    planHash: reviewPlanHash(snapshot),
    status,
    message,
  };
  suggestionOperations.set(pageKey, state);
  return state;
}

function clearOperationFeedback(pageKey, snapshot) {
  const operation = operationStateFor(pageKey, snapshot);
  if (operation.status !== 'applying') {
    setOperationState(pageKey, snapshot, 'idle');
  }
}

function clearAppliedConfirmations() {
  suggestionConfirmations.clear();
}

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
    editOnMount: true,

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

      const persisted = {
        [COMPROMISED_ACCOUNT_TRAP_KEY]: persistedIds[COMPROMISED_ACCOUNT_TRAP_KEY] ?? null,
      };
      const confirmation = destructiveConfirmationStateFor(pageKey, persisted, draft);
      if (
        confirmation.required
        && !confirmation.acknowledged
        && !errors[COMPROMISED_ACCOUNT_TRAP_KEY]
      ) {
        errors[COMPROMISED_ACCOUNT_TRAP_KEY] = 'Confirm automatic compromised-account enforcement before saving.';
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

export function mappingSuggestionGroups(snapshot) {
  const groups = { channels: [], roles: [], categories: [] };
  for (const item of snapshot?.mappings_review?.proposed || []) {
    const definition = MAPPING_RESOURCE_DEFINITIONS[item?.key];
    if (!definition || definition.manualOnly || !groups[definition.group]) continue;
    groups[definition.group].push({ ...item, group: definition.group });
  }
  return groups;
}

function approvedProposals(snapshot) {
  return (snapshot?.mappings_review?.proposed || []).filter(item => {
    const definition = MAPPING_RESOURCE_DEFINITIONS[item?.key];
    return Boolean(definition && !definition.manualOnly);
  });
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
  const confirmationState = confirmationStateFor(pageKey, snapshot);
  const confirmations = confirmationState.confirmedKeys;
  const operation = operationStateFor(pageKey, snapshot);
  const groups = mappingSuggestionGroups(snapshot);
  const required = approvedProposals(snapshot).filter(item => item.requires_confirmation);
  const allConfirmed = required.every(item => confirmations.has(item.key));
  const applyPending = operation.status === 'applying';

  const operationMarkup = operation.status === 'applying'
    ? '<p class="mapping-page-message mapping-suggestion-status" role="status" aria-live="polite">Applying reviewed mapping changes…</p>'
    : operation.status === 'success'
      ? '<p class="mapping-page-message mapping-suggestion-status" role="status" aria-live="polite">Reviewed mappings applied.</p>'
      : operation.status === 'error'
        ? `<p class="mapping-page-message mapping-suggestion-status" role="alert">${escapeHtml(operation.message)}</p>`
        : '';

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

  const reviewMarkup = quiet
    ? '<p class="mapping-suggestion-empty">No matches are suggested right now.</p>'
    : `${sections}
        <div class="mapping-suggestion-actions">
          <button class="control-button control-button-primary" type="button" data-mapping-apply-suggestions${allConfirmed && !applyPending ? '' : ' disabled'}>${applyPending ? 'Applying…' : 'Apply reviewed matches'}</button>
        </div>`;

  return `
    <section class="mapping-suggestions control-disclosure" data-suggestions-quiet="${String(quiet)}" data-suggestions-wrap data-open="${open}" aria-label="Suggested matches">
      <div class="control-reveal" id="mapping-suggestions-body"><div${open ? '' : ' inert'} data-suggestions-body>
        <p class="mapping-suggestions-hint">Nothing changes until you apply the reviewed matches.</p>
        ${operationMarkup}
        ${reviewMarkup}
      </div></div>
    </section>`;
}

function destructiveMappingMarkup(pageKey, state) {
  const confirmation = destructiveConfirmationStateFor(pageKey, state.persisted, state.draft ?? state.persisted);
  if (!confirmation.required) return '';

  const definition = MAPPING_RESOURCE_DEFINITIONS[COMPROMISED_ACCOUNT_TRAP_KEY];
  return `
    <aside class="mapping-destructive-warning" role="alert">
      <p>${escapeHtml(definition.warning)}</p>
      <label class="mapping-confirmation">
        <input type="checkbox" data-mapping-destructive-confirm="${COMPROMISED_ACCOUNT_TRAP_KEY}"${confirmation.acknowledged ? ' checked' : ''}>
        I understand that mapping this channel arms automatic compromised-account enforcement.
      </label>
    </aside>`;
}

function resourcesTabsMarkup(pageKey) {
  return segmentedControlMarkup({
    id: 'resource-tabs',
    label: 'Resource types',
    navigation: true,
    selected: pageKey,
    options: [
      { key: '/control/mappings/channels', label: 'Channels', href: '/control/mappings/channels' },
      { key: '/control/mappings/roles', label: 'Roles', href: '/control/mappings/roles' },
      { key: '/control/mappings/categories', label: 'Categories', href: '/control/mappings/categories' },
    ],
  });
}

const RESOURCES_LEDE = 'The Discord channels, roles and categories each feature uses.';

function selectedBinding(state, key) {
  if (state.draft) {
    const value = state.draft[key];
    return value == null || value === '' ? null : String(value);
  }
  return mappingId(state.persisted?.[key]);
}

// A saved binding that no longer works, as one sentence. Empty when the row is fine.
function brokenSentence(snapshot, persisted, key, problems) {
  const found = problems.find(item => item.resourceKey === key);
  if (found) return `${found.cause} ${found.effect}`;
  if (persisted?.id && persisted.exists === false) return 'Deleted in Discord.';
  return '';
}

function resourceTableMarkup(pageKey, state, snapshot) {
  const config = MAPPING_PAGE_CONFIGS[pageKey];
  const problems = problemsFromSnapshot(snapshot);
  const rows = config.resourceKeys.map((key, order) => {
    const persisted = state.persisted[key];
    const selected = selectedBinding(state, key);
    const sentence = brokenSentence(snapshot, persisted, key, problems);
    const unchanged = selected === mappingId(persisted);
    const error = state.errors?.[key];
    const hideError = key === COMPROMISED_ACCOUNT_TRAP_KEY && error && /^Confirm /.test(error);
    const text = (sentence && unchanged ? sentence : '') || (hideError ? '' : error || '');
    return { key, order, broken: Boolean(sentence), text, selected };
  });
  rows.sort((left, right) => (Number(right.broken) - Number(left.broken)) || (left.order - right.order));
  const body = rows.map(({ key, text, selected, broken }) => `
        <tr data-mapping-row="${escapeHtml(key)}" data-row-key="${escapeHtml(key)}"${text ? ' data-problem' : ''}${broken ? ' data-broken' : ''}>
          <th scope="row"><label class="mapping-used-for" for="mapping-${escapeHtml(key)}">${escapeHtml(MAPPING_RESOURCE_DEFINITIONS[key].label)}</label>${text ? problemLine(text) : ''}</th>
          <td>${resourceSelectMarkup({ snapshot, key, value: selected, problem: Boolean(text), id: `mapping-${key}` })}</td>
        </tr>`).join('');
  return `<div class="mapping-table-wrap"><table class="mapping-table">
      <thead><tr><th scope="col">Used for</th><th scope="col">Resource</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>`;
}

export function mappingPageMarkup({ pageKey, state, snapshot } = {}) {
  const config = MAPPING_PAGE_CONFIGS[pageKey];
  if (!config) return '';
  const open = suggestionReviewOpen.has(pageKey);
  const action = `<button class="control-button control-button-quiet" type="button" data-mapping-review aria-expanded="${open}" aria-controls="mapping-suggestions-body">Suggest matches</button>`;
  const header = controlPageHeaderMarkup({ title: 'Resources', lede: RESOURCES_LEDE, editable: false, actions: action });
  if (!state?.persisted) {
    return `<section class="control-page mapping-page">${header}${resourcesTabsMarkup(pageKey)}<p>Load current server state to manage these Discord resources.</p></section>`;
  }

  const statusMarkup = state.saveError
    ? `<p class="mapping-page-message" role="alert">${escapeHtml(state.saveError)}</p>`
    : state.status === 'conflict'
      ? '<p class="mapping-page-message" role="alert">Server state changed while you were editing. Review your draft before retrying.</p>'
      : '';

  return `
      <section class="control-page mapping-page" data-page-key="${escapeHtml(pageKey)}">
        ${header}
        ${resourcesTabsMarkup(pageKey)}
        ${statusMarkup}
        ${suggestionMarkup(pageKey, snapshot)}
        ${resourceTableMarkup(pageKey, state, snapshot)}
        ${destructiveMappingMarkup(pageKey, state)}
        ${stagedSaveBarMarkup(state, { saveAttribute: 'data-mapping-save', discardAttribute: 'data-mapping-discard' })}
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
  animateSegmentedThumbs(root);

  const onClick = async event => {
    const save = event.target?.closest?.('[data-mapping-save]');
    if (save) {
      if (store.canSave(pageKey)) onSave?.(pageKey, store.buildSaveRequest(pageKey));
      return;
    }

    const discard = event.target?.closest?.('[data-mapping-discard]');
    if (discard) {
      destructiveMappingConfirmations.delete(pageKey);
      store.discard(pageKey);
      rerender();
      return;
    }

    const review = event.target?.closest?.('[data-mapping-review]');
    if (review) {
      const hadFeedback = operationStateFor(pageKey, snapshot).status !== 'idle';
      if (suggestionReviewOpen.has(pageKey)) {
        suggestionReviewOpen.delete(pageKey);
      } else {
        suggestionReviewOpen.add(pageKey);
      }
      clearOperationFeedback(pageKey, snapshot);
      const wrap = root.querySelector?.('[data-suggestions-wrap]');
      const body = wrap?.querySelector?.('[data-suggestions-body]');
      if (wrap && body && !hadFeedback) {
        // Open and close in place so the reveal animates.
        const open = suggestionReviewOpen.has(pageKey);
        wrap.dataset.open = String(open);
        body.inert = !open;
        review.setAttribute?.('aria-expanded', String(open));
      } else {
        rerender();
      }
      return;
    }

    const apply = event.target?.closest?.('[data-mapping-apply-suggestions]');
    if (apply) {
      const operation = operationStateFor(pageKey, snapshot);
      if (operation.status === 'applying' || !onApplySuggestions) return;

      const confirmations = confirmationStateFor(pageKey, snapshot).confirmedKeys;
      const required = approvedProposals(snapshot).filter(item => item.requires_confirmation);
      if (!required.every(item => confirmations.has(item.key))) return;

      setOperationState(
        pageKey,
        snapshot,
        'applying',
        'Applying reviewed mapping changes…',
      );
      rerender();

      try {
        const result = await onApplySuggestions(
          mappingSuggestionApplyPayload(snapshot, confirmations),
        );
        clearAppliedConfirmations();

        const reconciledSnapshot = result?.snapshot || snapshot;
        setOperationState(
          pageKey,
          reconciledSnapshot,
          'success',
          'Reviewed mappings applied.',
        );
        rerender();

        const successPlanHash = reviewPlanHash(reconciledSnapshot);
        const timer = setTimeout(() => {
          const current = suggestionOperations.get(pageKey);
          if (
            current?.planHash === successPlanHash
            && current.status === 'success'
          ) {
            suggestionOperations.set(pageKey, {
              planHash: successPlanHash,
              status: 'idle',
              message: '',
            });
            rerender();
          }
        }, 1800);
        timer?.unref?.();
      } catch (error) {
        const message = error instanceof Error && error.message
          ? error.message
          : 'The reviewed mappings could not be applied.';
        setOperationState(pageKey, snapshot, 'error', message);
        rerender();
      }
    }
  };

  const onChange = event => {
    const field = event.target?.closest?.('[data-resource-select]');
    if (field?.dataset?.resourceSelect) {
      const key = field.dataset.resourceSelect;
      if (MAPPING_RESOURCE_DEFINITIONS[key] && MAPPING_PAGE_CONFIGS[pageKey].resourceKeys.includes(key)) {
        store.updateDraft(pageKey, draft => {
          draft[key] = field.value === '' ? null : String(field.value);
        });
        rerender();
        return;
      }
    }

    const destructiveConfirmation = event.target?.closest?.('[data-mapping-destructive-confirm]');
    if (
      destructiveConfirmation?.dataset?.mappingDestructiveConfirm
      === COMPROMISED_ACCOUNT_TRAP_KEY
    ) {
      const state = store.get(pageKey);
      const selectedId = mappingId(state.draft?.[COMPROMISED_ACCOUNT_TRAP_KEY]);
      destructiveMappingConfirmations.set(pageKey, {
        selectedId,
        acknowledged: Boolean(destructiveConfirmation.checked),
        required: true,
      });
      store.updateDraft(pageKey, draft => draft);
      rerender();
      return;
    }

    const confirmation = event.target?.closest?.('[data-mapping-confirm-key]');
    if (confirmation?.dataset?.mappingConfirmKey) {
      const key = confirmation.dataset.mappingConfirmKey;
      const confirmationState = confirmationStateFor(pageKey, snapshot);
      const confirmations = new Set(confirmationState.confirmedKeys);
      if (confirmation.checked) confirmations.add(key);
      else confirmations.delete(key);
      suggestionConfirmations.set(pageKey, {
        planHash: confirmationState.planHash,
        confirmedKeys: confirmations,
      });
      clearOperationFeedback(pageKey, snapshot);
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
