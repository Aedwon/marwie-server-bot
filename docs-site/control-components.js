import { activityPageMarkup, commandsPageMarkup } from './control-secondary.js';
import { controlIcon } from './control-icons.js?v=2';

export { navigationMarkup } from './control-shell.js?v=2';

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
  lede = '',
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
  const metaMarkup = meta
    ? `<div class="control-page-meta">${meta}</div>`
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
      ${description || lede ? `<p class="control-page-intro">${escapeHtml(lede || description)}</p>` : ''}
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


/* ---------- Page model: settings rows, master switch, problems, disclosure ---------- */

let rowIdCounter = 0;
const nextRowId = prefix => `${prefix}-${(rowIdCounter += 1)}`;

// A warning icon and one sentence. No role: the save bar and live region announce changes.
export function problemLine(text) {
  if (!text) return '';
  return `<p class="control-problem">${controlIcon('warning', { size: 14, className: 'control-problem-icon' })}<span>${escapeHtml(text)}</span></p>`;
}

// Container for settingRow markup. `master` ('on' | 'off') dims every row after the master switch when off.
export function settingsRows(rows = '', { label = '', master = '' } = {}) {
  const labelAttr = label ? ` role="group" aria-label="${escapeHtml(label)}"` : '';
  const masterAttr = master ? ` data-master="${escapeHtml(master)}"` : '';
  return `<div class="control-settings-rows" data-settings-rows${labelAttr}${masterAttr}>${rows}</div>`;
}

// One row: label and hint left, one control in the fixed control column right.
// A problem replaces the hint and marks the row with data-problem.
export function settingRow({
  label,
  hint = '',
  problem = '',
  control = '',
  rowKey = '',
  controlId = '',
  master = false,
} = {}) {
  const labelMarkup = controlId
    ? `<label class="control-setting-label" for="${escapeHtml(controlId)}">${escapeHtml(label)}</label>`
    : `<span class="control-setting-label">${escapeHtml(label)}</span>`;
  const detail = problem
    ? problemLine(problem)
    : (hint ? `<p class="control-setting-hint">${escapeHtml(hint)}</p>` : '');
  const key = rowKey ? ` data-row-key="${escapeHtml(rowKey)}"` : '';
  return `<div class="control-setting-row"${key}${problem ? ' data-problem' : ''}${master ? ' data-master-row' : ''} data-setting-row>
    <div class="control-setting-copy">${labelMarkup}${detail}</div>
    <div class="control-setting-control">${control}</div>
  </div>`;
}

export function switchMarkup({ checked = false, attributes = '', id = '', label = '' } = {}) {
  const idAttr = id ? ` id="${escapeHtml(id)}"` : '';
  const labelAttr = label ? ` aria-label="${escapeHtml(label)}"` : '';
  return `<span class="control-switch"><input type="checkbox" role="switch"${idAttr}${labelAttr}${attributes ? ` ${attributes}` : ''}${checked ? ' checked' : ''}><span class="control-switch-track" aria-hidden="true"></span></span>`;
}

// The first row of a feature page. The label is a verb phrase. When off, offHint states the effect.
export function masterSwitchRow({
  label,
  hint = '',
  offHint = '',
  checked = false,
  field = 'enabled',
  attribute = 'data-setting-field',
} = {}) {
  const id = nextRowId('control-master');
  return settingRow({
    label,
    hint: checked ? hint : offHint,
    controlId: id,
    rowKey: 'master',
    master: true,
    control: switchMarkup({ checked, id, attributes: `${attribute}="${escapeHtml(field)}"` }),
  });
}

// Bordered number input with its unit after it.
export function numberWithUnit({
  value = '',
  unit = '',
  min = null,
  max = null,
  step = 1,
  id = '',
  attributes = '',
  placeholder = '',
  label = '',
} = {}) {
  const idAttr = id ? ` id="${escapeHtml(id)}"` : '';
  const labelAttr = label ? ` aria-label="${escapeHtml(label)}"` : '';
  const placeholderAttr = placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : '';
  return `<span class="control-number"><input class="control-number-input" type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" data-min="${min ?? ""}" data-max="${max ?? ""}"${idAttr}${labelAttr}${placeholderAttr}${attributes ? ` ${attributes}` : ''} value="${value == null ? '' : escapeHtml(value)}">${unit ? `<span class="control-unit">${escapeHtml(unit)}</span>` : ''}</span>`;
}

// Open state survives page re-renders. Keyed by disclosure id.
const openDisclosures = new Set();
export const isDisclosureOpen = id => openDisclosures.has(id);
export function setDisclosureOpen(id, open) {
  if (open) openDisclosures.add(id);
  else openDisclosures.delete(id);
}

// The one disclosure pattern: a button with a chevron that reveals its body in place.
// `trigger` replaces the plain label when the whole row is the button.
export function disclosure({ id, label = '', trigger = '', body = '', open = null, className = '' } = {}) {
  const isOpen = open == null ? isDisclosureOpen(id) : Boolean(open);
  const bodyId = `control-disclosure-${id}`;
  return `<div class="control-disclosure${className ? ` ${className}` : ''}" data-disclosure="${escapeHtml(id)}" data-open="${isOpen}">
    <button type="button" class="control-disclose" data-disclosure-toggle aria-expanded="${isOpen}" aria-controls="${escapeHtml(bodyId)}">${trigger || escapeHtml(label)}${controlIcon('chevron', { size: 12, className: 'control-disclose-chev' })}</button>
    <div class="control-reveal" id="${escapeHtml(bodyId)}"><div${isOpen ? '' : ' inert'} data-disclosure-body>${body}</div></div>
  </div>`;
}

// Flips one disclosure from its toggle button and records the state. Returns the new open state.
export function toggleDisclosure(button) {
  const container = button?.closest?.('[data-disclosure]');
  if (!container) return null;
  const open = container.dataset.open !== 'true';
  container.dataset.open = String(open);
  button.setAttribute('aria-expanded', String(open));
  const body = container.querySelector('[data-disclosure-body]');
  if (body) body.inert = !open;
  setDisclosureOpen(container.dataset.disclosure, open);
  return open;
}

// Section on a settings page: h2 15px with the rows beneath it.
export function settingsSection({ id = '', title, body = '', action = '' } = {}) {
  const headingId = id ? ` id="${escapeHtml(id)}"` : '';
  return `<section class="control-settings-section"${id ? ` aria-labelledby="${escapeHtml(id)}"` : ''}>
    <div class="control-settings-heading"><h2${headingId}>${escapeHtml(title)}</h2>${action}</div>
    ${body}
  </section>`;
}

// Pure: which rows a saved page save touched, so they can flash once.
export function savedRowKeys(changes = []) {
  const keys = new Set();
  for (const change of changes || []) {
    const payload = change?.payload || {};
    switch (change?.action_type) {
      case 'set_feature': keys.add('master'); break;
      case 'set_resource':
      case 'clear_resource': if (payload.key) keys.add(String(payload.key)); break;
      case 'set_reputation_thresholds': ['builder', 'contributor', 'mentor'].forEach(tier => keys.add(`threshold:${tier}`)); break;
      case 'set_quiz_schedule': keys.add('intervalHours'); break;
      case 'update_quiz_question':
      case 'set_quiz_question_enabled': keys.add(`question:${payload.question_id}`); break;
      default: break;
    }
  }
  return [...keys];
}
