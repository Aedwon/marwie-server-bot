import { activityPageMarkup, commandsPageMarkup } from './control-secondary.js';

export { navigationMarkup } from './control-shell.js?v=1';

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\"', '&quot;')
    .replaceAll("'", '&#39;');
}

const TASK_INDICATOR_SIZES = new Set([16, 18, 22]);
const TASK_INDICATOR_STATES = new Set(['queued', 'running', 'progress', 'completed', 'blocked', 'failed']);

function taskIndicatorDefaultLabel(state, progress) {
  if (state === 'progress') return `In progress ${progress}%`;
  return ({
    queued: 'Queued',
    running: 'In progress',
    completed: 'Completed',
    blocked: 'Blocked',
    failed: 'Failed',
  })[state];
}

export function taskIndicatorMarkup({ state = 'queued', size = 22, progress = null, label = '' } = {}) {
  const normalizedState = String(state || '').trim().toLowerCase();
  const normalizedSize = Number(size);
  if (!TASK_INDICATOR_STATES.has(normalizedState)) throw new TypeError(`Unsupported task indicator state: ${state}`);
  if (!TASK_INDICATOR_SIZES.has(normalizedSize)) throw new TypeError(`Unsupported task indicator size: ${size}`);

  let normalizedProgress = null;
  if (normalizedState === 'progress') {
    normalizedProgress = Number(progress);
    if (!Number.isFinite(normalizedProgress)) throw new TypeError('Determinate progress requires a finite progress value.');
    normalizedProgress = Math.max(0, Math.min(100, normalizedProgress));
  }

  const progressAttribute = normalizedProgress === null ? '' : ` data-progress="${normalizedProgress}"`;
  const dash = normalizedProgress === null ? '18 82' : `${normalizedProgress} ${100 - normalizedProgress}`;
  const visibleLabel = String(label || taskIndicatorDefaultLabel(normalizedState, normalizedProgress));

  return `<span class="control-task-status" data-task-indicator data-state="${normalizedState}" data-size="${normalizedSize}"${progressAttribute}>
    <svg class="control-task-indicator" width="${normalizedSize}" height="${normalizedSize}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle class="control-task-indicator-track" cx="12" cy="12" r="8.5" fill="none" stroke-width="2.7273" pathLength="100"></circle>
      <g class="control-task-indicator-orbit">
        <circle class="control-task-indicator-active" cx="12" cy="12" r="8.5" fill="none" stroke-width="2.7273" pathLength="100" stroke-dasharray="${dash}"></circle>
      </g>
      <circle class="control-task-indicator-complete" cx="12" cy="12" r="12"></circle>
      <path class="control-task-indicator-check" d="M7.1 12.1 10.4 15.4 17 8.8"></path>
    </svg>
    <span class="control-task-indicator-label">${escapeHtml(visibleLabel)}</span>
  </span>`;
}

export function stateChipMarkup(enabled, { label = '' } = {}) {
  const on = Boolean(enabled);
  const text = label || (on ? 'Enabled' : 'Disabled');
  return `<span class="control-state-chip" data-tone="${on ? 'good' : 'neutral'}" data-enabled="${String(on)}">${escapeHtml(text)}</span>`;
}

export function pendingChangeCount(state = {}) {
  if (!state?.dirty) return 0;
  const stored = Number(state.changeCount);
  if (Number.isFinite(stored) && stored > 0) return stored;
  const diff = state.definition?.diffDraft?.(state.persisted, state.draft) || [];
  return Math.max(1, diff.length, state.retryChanges?.length || 0);
}

export function saveBarStatusLabel(state = {}) {
  if (state.status === 'saving') return 'Saving';
  const count = pendingChangeCount(state);
  if (count < 1) return 'No unsaved changes';
  return `${count} unsaved change${count === 1 ? '' : 's'}`;
}

export function saveBarStatusMarkup(state = {}) {
  const label = saveBarStatusLabel(state);
  return `<span class="control-save-bar-status" data-save-bar-status data-tone="neutral">
    <span data-save-bar-status-text data-default-label="${escapeHtml(label)}">${escapeHtml(label)}</span>
    <span class="control-save-bar-message" data-save-bar-message hidden></span>
  </span>`;
}

export const SAVE_BAR_HOLD_MS = 900;
export const SAVE_BAR_BLOCKED_MESSAGE = 'Save or discard your changes first';
export const SAVE_BAR_CONFLICT_MESSAGE = 'Server settings changed. Review and save again.';

// Pure: maps one page's store state to what the floating save bar shows.
export function saveBarView(state, { blocked = false } = {}) {
  const hidden = {
    kind: 'hidden', visible: false, message: '', count: 0, saveLabel: 'Save changes',
    saveDisabled: true, discardDisabled: true, spinner: false, check: false, showReload: false, nudge: false, holdMs: 0,
  };
  if (!state) return hidden;
  const count = pendingChangeCount(state);
  const dirty = Boolean(state.dirty);
  const invalid = Boolean(Object.keys(state.errors || {}).length);
  const saving = state.status === 'saving';
  const view = (kind, extra = {}) => ({
    ...hidden, kind, visible: true, count,
    saveDisabled: !dirty || invalid || saving, discardDisabled: saving, ...extra,
  });

  if (blocked && dirty) return view('blocked', { message: SAVE_BAR_BLOCKED_MESSAGE, nudge: true });
  if (saving) return view('saving', { message: 'Saving', spinner: true, saveDisabled: true, discardDisabled: true });
  if (state.status === 'conflict') return view('conflict', { message: SAVE_BAR_CONFLICT_MESSAGE, showReload: true });
  if (state.saveError) return view('failed', { message: String(state.saveError), saveLabel: 'Retry' });
  if (state.status === 'saved') {
    return view('saved', { message: 'Saved', check: true, saveDisabled: true, discardDisabled: true, holdMs: SAVE_BAR_HOLD_MS });
  }
  if (dirty) return view('dirty', { message: saveBarStatusLabel(state) });
  return hidden;
}

export function controlPageHeaderMarkup({
  title,
  description = '',
  enabled = null,
  editing = false,
  editable = true,
  editAttribute = '',
  toggleAttribute = '',
  features = null,
  actions = '',
  meta = '',
  showFeatureToggle = true,
} = {}) {
  const state = !editing && typeof enabled === 'boolean'
    ? stateChipMarkup(enabled)
    : '';
  const metaMarkup = state || meta
    ? `<div class="control-page-meta">${state}${meta}</div>`
    : '';
  const resolvedActions = actions || (editable
    ? (!editing || showFeatureToggle
      ? featureHeaderActionsMarkup({
        label: title,
        enabled: Boolean(enabled),
        editing,
        editAttribute,
        toggleAttribute,
        features,
      })
      : '')
    : '');
  return `<header class="control-page-header" data-page-header>
    <div class="control-page-heading">
      <h1>${escapeHtml(title)}</h1>
      ${description ? `<p class="control-page-intro">${escapeHtml(description)}</p>` : ''}
      ${metaMarkup}
    </div>
    <div class="control-page-header-actions">${resolvedActions || ''}</div>
  </header>`;
}

export function controlSimplePageHeaderMarkup({ title, description = '', actions = '' } = {}) {
  return controlPageHeaderMarkup({
    title,
    description,
    editable: false,
    actions,
  });
}

export function controlSectionMarkup({
  id = '',
  title,
  description = '',
  action = '',
  body = '',
  className = '',
} = {}) {
  const headingId = id ? ` id="${escapeHtml(id)}"` : '';
  const heading = title
    ? `<div class="control-section-heading"><div><h2${headingId}>${escapeHtml(title)}</h2>${description ? `<p>${escapeHtml(description)}</p>` : ''}</div>${action}</div>`
    : '';
  return `<section class="control-section${className ? ` ${className}` : ''}"${id ? ` aria-labelledby="${escapeHtml(id)}"` : ''}>${heading}${body}</section>`;
}

export function contextSectionMarkup({ id = '', title, description = '', body = '', className = '' } = {}) {
  return `<section class="control-context-section${className ? ` ${className}` : ''}"${id ? ` data-context-section="${escapeHtml(id)}"` : ''}>
    <h2>${escapeHtml(title)}</h2>
    ${description ? `<p>${escapeHtml(description)}</p>` : ''}
    ${body}
  </section>`;
}

export function contextDefinitionListMarkup(rows = []) {
  return `<dl class="control-context-list">${rows.map(row => `<div><dt>${escapeHtml(row.label)}</dt><dd>${escapeHtml(row.value)}</dd></div>`).join('')}</dl>`;
}

export function contextStatusMarkup(label, tone = 'neutral') {
  return `<span class="control-context-status" data-tone="${escapeHtml(tone)}">${escapeHtml(label)}</span>`;
}

export function featureHeaderActionsMarkup({
  label = 'Feature',
  enabled = false,
  editing = false,
  editAttribute = '',
  toggleAttribute = '',
  features = null,
} = {}) {
  if (!editing) {
    return `<div class="control-feature-header-actions"><button class="control-button control-button-primary" type="button"${editAttribute ? ` ${editAttribute}` : ''}>Edit settings</button></div>`;
  }

  const items = Array.isArray(features) && features.length
    ? features
    : [{label, enabled, toggleAttribute}];
  const toggles = items.map(item => {
    const itemLabel = item.label || 'Feature';
    const itemEnabled = Boolean(item.enabled);
    const interactive = item.toggleAttribute ? ` ${item.toggleAttribute}` : '';
    const checked = itemEnabled ? ' checked' : '';
    return `<label class="control-feature-toggle control-feature-toggle-editing">
      <input type="checkbox"${interactive}${checked} aria-label="${escapeHtml(itemLabel)} ${itemEnabled ? 'enabled' : 'disabled'}">
      <span class="control-feature-toggle-track" aria-hidden="true"></span>
      <span class="control-feature-toggle-copy">${itemEnabled ? 'Enabled' : 'Disabled'}</span>
    </label>`;
  }).join('');
  return `<div class="control-feature-header-actions">${toggles}</div>`;
}

export function pageMarkup(destination, { authenticated = false, activityState = null } = {}) {
  if (!authenticated) {
    return `<section class="control-empty"><h1>${escapeHtml(destination.label)}</h1><p>Sign in with Discord from the top bar to load Control.</p></section>`;
  }

  if (destination.path === '/control/commands') return commandsPageMarkup();
  if (destination.path === '/control/activity') return activityPageMarkup(activityState || {});

  const intro = destination.domain === 'workflows'
    ? `Operational guidance for ${escapeHtml(destination.label)}. Configuration remains with its owning Control destination or command.`
    : `Review the current Rob-bot state for ${escapeHtml(destination.label)}.`;

  return `<section class="control-page-section" data-page-key="${escapeHtml(destination.path)}">
    <h1>${escapeHtml(destination.label)}</h1>
    <p class="control-page-intro">${intro}</p>
  </section>`;
}
