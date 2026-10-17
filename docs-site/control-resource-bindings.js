import { MAPPING_RESOURCE_DEFINITIONS, mappingOptionsForKey } from './control-mappings.js';

const TRAP_KEY = 'compromised_account_trap';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function resourceRows(snapshot) {
  return new Map((snapshot?.resources || []).map(item => [String(item?.key || ''), item]));
}

function bindingsFor(snapshot, keys) {
  const rows = resourceRows(snapshot);
  return Object.fromEntries(keys.map(key => {
    const row = rows.get(key);
    return [key, row?.id == null ? null : String(row.id)];
  }));
}

function cloneMap(value) {
  return Object.fromEntries(Object.entries(value || {}));
}

function resourceStatus(snapshot, key, selectedId) {
  const rows = resourceRows(snapshot);
  const row = rows.get(key);
  const selected = selectedId == null || selectedId === '' ? null : String(selectedId);
  if (!selected) {
    return { label: 'Not connected', tone: 'neutral', current: 'No resource connected' };
  }
  if (row?.id != null && String(row.id) === selected && row?.exists) {
    return {
      label: key === TRAP_KEY ? 'Armed' : 'Connected',
      tone: 'good',
      current: row.name || 'Connected Discord resource',
    };
  }
  const option = mappingOptionsForKey(snapshot, key).find(item => String(item.id) === selected);
  if (option) {
    return { label: 'Ready to save', tone: 'info', current: option.name || 'Selected Discord resource' };
  }
  return { label: 'Unavailable', tone: 'bad', current: 'Previously connected resource is unavailable' };
}

function trapChanged(persisted, draft) {
  const before = persisted?.resourceBindings?.[TRAP_KEY] ?? null;
  const after = draft?.resourceBindings?.[TRAP_KEY] ?? null;
  return after !== null && after !== '' && after !== before;
}

export function resourceContextMarkup({ pageKey, state, snapshot, resourceKeys = [] } = {}) {
  if (!resourceKeys.length || !state?.persisted) return '';
  const editing = state.mode === 'edit';
  const values = editing ? state.draft : state.persisted;
  const fields = resourceKeys.map(key => {
    const definition = MAPPING_RESOURCE_DEFINITIONS[key];
    if (!definition) return '';
    const selected = values?.resourceBindings?.[key] ?? null;
    const status = resourceStatus(snapshot, key, selected);

    if (!editing) {
      return `
        <div class="control-resource-row" data-resource-key="${escapeHtml(key)}">
          <div><strong>${escapeHtml(definition.label)}</strong><small>${escapeHtml(status.current)}</small></div>
          <span class="control-resource-status" data-tone="${status.tone}">${escapeHtml(status.label)}</span>
        </div>`;
    }

    const options = mappingOptionsForKey(snapshot, key);
    const selectedId = selected == null ? '' : String(selected);
    const stale = Boolean(selectedId && !options.some(option => String(option.id) === selectedId));
    const optionsMarkup = options.map(option => `
      <option value="${escapeHtml(option.id)}"${String(option.id) === selectedId ? ' selected' : ''}>${escapeHtml(option.name || 'Unnamed Discord resource')}</option>`).join('');
    const error = state.errors?.[`resource_${key}`];
    const confirmation = key === TRAP_KEY && trapChanged(state.persisted, state.draft)
      ? `<label class="control-resource-confirm"><input type="checkbox" data-resource-confirm="${TRAP_KEY}"${state.draft?.resourceAcknowledgements?.[TRAP_KEY] ? ' checked' : ''}> I understand that new human messages in this channel trigger compromised-account enforcement.</label>`
      : '';

    return `
      <label class="control-resource-field" data-resource-key="${escapeHtml(key)}">
        <span>${escapeHtml(definition.label)}</span>
        <select data-resource-select="${escapeHtml(key)}">
          <option value=""${selectedId === '' ? ' selected' : ''}>Not connected</option>
          ${stale ? `<option value="${escapeHtml(selectedId)}" disabled selected>Unavailable current mapping</option>` : ''}
          ${optionsMarkup}
        </select>
        ${confirmation}
        ${error ? `<small class="control-resource-error" role="alert">${escapeHtml(error)}</small>` : ''}
      </label>`;
  }).join('');

  return `
    <section class="control-context-section control-resource-context" data-resource-page="${escapeHtml(pageKey)}">
      <h2>Discord resources</h2>
      <p>${editing ? 'Changes save with this feature.' : 'Canonical bindings used by this feature.'}</p>
      ${fields}
    </section>`;
}

export function withResourceBindings(definition, resourceKeys = []) {
  const keys = [...resourceKeys];
  if (!keys.length) return definition;

  let latestSnapshot = {};
  const baseSelect = definition.selectPersisted.bind(definition);
  const baseClone = definition.cloneDraft?.bind(definition);
  const baseValidate = definition.validateDraft?.bind(definition);
  const baseDiff = definition.diffDraft?.bind(definition);
  const baseContext = definition.renderContext?.bind(definition);
  const baseInstall = definition.install?.bind(definition);

  return {
    ...definition,
    selectPersisted(snapshot) {
      latestSnapshot = snapshot || {};
      return {
        ...baseSelect(snapshot),
        resourceBindings: bindingsFor(snapshot, keys),
        resourceAcknowledgements: {},
      };
    },
    cloneDraft(value) {
      const base = baseClone ? baseClone(value) : structuredClone(value);
      return {
        ...base,
        resourceBindings: cloneMap(value?.resourceBindings),
        resourceAcknowledgements: cloneMap(value?.resourceAcknowledgements),
      };
    },
    validateDraft(draft) {
      const errors = { ...(baseValidate?.(draft) || {}) };
      for (const key of keys) {
        const selected = draft?.resourceBindings?.[key] ?? null;
        if (selected == null || selected === '') continue;
        const valid = mappingOptionsForKey(latestSnapshot, key)
          .some(option => String(option.id) === String(selected));
        if (!valid) {
          errors[`resource_${key}`] = `${MAPPING_RESOURCE_DEFINITIONS[key]?.label || key} must use an available Discord resource.`;
        }
      }
      if (keys.includes(TRAP_KEY)) {
        const persisted = { resourceBindings: bindingsFor(latestSnapshot, keys) };
        if (trapChanged(persisted, draft) && !draft?.resourceAcknowledgements?.[TRAP_KEY]) {
          errors[`resource_${TRAP_KEY}`] = 'Confirm automatic compromised-account enforcement before saving.';
        }
      }
      return errors;
    },
    diffDraft(persisted, draft) {
      const resourceChanges = [];
      for (const key of keys) {
        const current = persisted?.resourceBindings?.[key] ?? null;
        const selected = draft?.resourceBindings?.[key] ?? null;
        if (current === selected) continue;
        resourceChanges.push(selected == null || selected === ''
          ? { action_type: 'clear_resource', payload: { key } }
          : { action_type: 'set_resource', payload: { key, discord_id: String(selected) } });
      }
      return [...resourceChanges, ...(baseDiff?.(persisted, draft) || [])];
    },
    renderContext(context = {}) {
      const base = baseContext?.(context) || '';
      return `${base}${resourceContextMarkup({ ...context, pageKey: definition.pageKey, resourceKeys: keys })}`;
    },
    install(context = {}) {
      const cleanupBase = baseInstall?.(context) || (() => {});
      const cleanupResources = installResourceContextInteractions({ ...context, pageKey: definition.pageKey });
      return () => {
        cleanupResources();
        cleanupBase();
      };
    },
  };
}

export function installResourceContextInteractions({ contextRoot, store, pageKey, rerender } = {}) {
  if (!contextRoot || !store || !pageKey) return () => {};

  const onChange = event => {
    const select = event.target.closest?.('[data-resource-select]');
    if (select) {
      const key = select.dataset.resourceSelect;
      store.updateDraft(pageKey, draft => {
        draft.resourceBindings ||= {};
        draft.resourceAcknowledgements ||= {};
        draft.resourceBindings[key] = select.value || null;
        if (key === TRAP_KEY) draft.resourceAcknowledgements[TRAP_KEY] = false;
      });
      rerender?.();
      return;
    }

    const confirm = event.target.closest?.('[data-resource-confirm]');
    if (confirm) {
      const key = confirm.dataset.resourceConfirm;
      store.updateDraft(pageKey, draft => {
        draft.resourceAcknowledgements ||= {};
        draft.resourceAcknowledgements[key] = Boolean(confirm.checked);
      });
      rerender?.();
    }
  };

  contextRoot.addEventListener('change', onChange);
  return () => contextRoot.removeEventListener('change', onChange);
}
