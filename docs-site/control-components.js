import { activityPageMarkup, commandsPageMarkup } from './control-secondary.js';
import { controlIcon, hasControlIcon } from './control-icons.js';

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
  const contextTrigger = `<button class="control-context-trigger" type="button" data-control-context-open data-context-trigger="page" aria-controls="controlContextDrawer" aria-expanded="false" aria-label="Open page context" title="Context" hidden>${controlIcon('sidebar-simple', { size: 18 })}<span class="sr-only">Context</span></button>`;
  return `<header class="control-page-header" data-page-header>
    <div class="control-page-heading">
      <h1>${escapeHtml(title)}</h1>
      ${description ? `<p class="control-page-intro">${escapeHtml(description)}</p>` : ''}
      ${metaMarkup}
    </div>
    <div class="control-page-header-actions">${contextTrigger}${resolvedActions || ''}</div>
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
  const edit = editing ? '' : `<button class="control-button control-button-primary control-edit-settings-button" type="button"${editAttribute ? ` ${editAttribute}` : ''}>Edit settings</button>`;
  return `<div class="control-feature-header-actions">${edit}${toggles}</div>`;
}

function navIconMarkup(name, { rail = false, group = false } = {}) {
  if (!hasControlIcon(name)) return '';
  const className = group ? 'control-nav-group-icon' : (rail ? 'control-nav-icon control-nav-icon-rail' : 'control-nav-icon');
  return controlIcon(name, { size: group ? 16 : (rail ? 20 : 17), className });
}

function navLabelMarkup(label, { rail = false } = {}) {
  return rail
    ? `<span class="sr-only">${escapeHtml(label)}</span>`
    : `<span class="control-nav-label">${escapeHtml(label)}</span>`;
}

export function navigationMarkup(model, { rail = false } = {}) {
  const primary = model.primary.map(group => {
    const children = group.children.map(child => {
      const matchDomain = child.matchDomain ? ` data-nav-match-domain="${escapeHtml(child.matchDomain)}"` : '';
      const accessibleLabel = rail ? ` aria-label="${escapeHtml(child.label)}"` : '';
      return `
      <a href="${child.path}" data-nav-path="${child.path}" data-nav-key="${escapeHtml(child.key)}"${matchDomain}${accessibleLabel}${child.current ? ' aria-current="page"' : ''}>${navIconMarkup(child.icon, { rail })}${navLabelMarkup(child.label, { rail })}</a>`;
    }).join('');

    if (rail) {
      return `<section class="control-nav-domain control-nav-domain-rail${group.current ? ' control-nav-domain-current' : ''}" data-domain="${group.key}">
      <div class="control-nav-children">${children}</div>
    </section>`;
    }

    return `<section class="control-nav-domain${group.expanded ? ' control-nav-domain-open' : ''}${group.current ? ' control-nav-domain-current' : ''}" data-domain="${group.key}">
      <button type="button" data-domain-select="${group.key}" aria-expanded="${group.expanded ? 'true' : 'false'}">
        <span class="control-nav-domain-label">${navIconMarkup(group.icon, { group: true })}<span>${escapeHtml(group.label)}</span></span>
      </button>
      <div class="control-nav-children"${group.expanded ? '' : ' hidden'}>${children}</div>
    </section>`;
  }).join('');

  const secondary = model.secondary.map(item => {
    const accessibleLabel = rail ? ` aria-label="${escapeHtml(item.label)}"` : '';
    return `
    <a href="${item.path}" data-nav-path="${item.path}"${accessibleLabel}${item.current ? ' aria-current="page"' : ''}>${navIconMarkup(item.icon, { rail })}${navLabelMarkup(item.label, { rail })}</a>`;
  }).join('');
  const playbooks = secondary
    ? `<div class="control-playbooks${rail ? ' control-playbooks-rail' : ''}">${rail ? '' : '<p class="control-nav-group-label">Playbooks</p>'}<nav class="control-secondary-nav" aria-label="Control playbooks">${secondary}</nav></div>`
    : '';

  return `<nav class="control-primary-nav${rail ? ' control-primary-nav-rail' : ''}" aria-label="Control destinations">${primary}</nav>${playbooks}`;
}

export function identityMarkup(session, guild) {
  if (!session?.authenticated) {
    return '<a class="control-login" href="/api/auth/start"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515c.074.134.144.273.21.416a18.27 18.27 0 0 0-5.356 0c.067-.143.137-.282.21-.416A19.74 19.74 0 0 0 3.678 4.37C.533 9.046-.321 13.58.106 18.058a19.9 19.9 0 0 0 5.994 3.03c.49-.669.927-1.383 1.302-2.134a12.93 12.93 0 0 1-2.058-.988c.172-.126.341-.255.505-.391 3.862 1.763 8.052 1.763 11.868 0 .165.136.333.265.505.391-.653.39-1.343.721-2.059.988.376.751.813 1.465 1.303 2.134a19.89 19.89 0 0 0 5.992-3.03c.501-5.177-.854-9.673-3.548-13.688ZM7.822 14.709c-1.171 0-2.139-1.076-2.139-2.397s.948-2.397 2.139-2.397c1.201 0 2.159 1.086 2.139 2.397 0 1.321-.948 2.397-2.139 2.397Zm7.457 0c-1.171 0-2.139-1.076-2.139-2.397s.948-2.397 2.139-2.397c1.201 0 2.159 1.086 2.139 2.397 0 1.321-.938 2.397-2.139 2.397Z"/></svg><span>Sign in with Discord</span></a>';
  }
  const avatar = session.user?.avatar_url
    ? `<img src="${escapeHtml(session.user.avatar_url)}" alt="">`
    : `<span class="control-avatar" aria-hidden="true">${escapeHtml((session.user?.name || '?').slice(0, 1))}</span>`;
  return `<div class="control-account">
      <button class="control-user control-account-trigger" type="button"
        data-account-trigger aria-haspopup="menu" aria-expanded="false">
        ${avatar}
        <span class="control-account-copy">
          <strong>${escapeHtml(session.user?.name || 'Discord user')}</strong>
          <small>${escapeHtml(guild?.name || 'Rob-bot server')}</small>
        </span>
      </button>
      <div class="control-account-menu" data-account-menu role="menu" hidden>
        <a href="/" role="menuitem">Rob-bot Handbook</a>
        <a href="/commands" role="menuitem">Commands</a>
        <button type="button" role="menuitem" data-account-sign-out>Sign out</button>
      </div>
    </div>`;
}

export function pageMarkup(destination, { authenticated = false, activityState = null } = {}) {
  if (!authenticated) {
    return `<section class="control-empty"><h1>${escapeHtml(destination.label)}</h1><p>Sign in with Discord to load Control.</p><a class="control-primary-button" href="/api/auth/start">Sign in with Discord</a></section>`;
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
