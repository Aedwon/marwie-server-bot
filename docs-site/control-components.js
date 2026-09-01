import { activityPageMarkup, commandsPageMarkup } from './control-secondary.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function featureHeaderActionsMarkup({
  label = 'Feature',
  enabled = false,
  editing = false,
  editAttribute = '',
  toggleAttribute = '',
  features = null,
} = {}) {
  const items = Array.isArray(features) && features.length
    ? features
    : [{ label, enabled, toggleAttribute }];
  const toggles = items.map(item => {
    const itemLabel = item.label || 'Feature';
    const itemEnabled = Boolean(item.enabled);
    const interactive = editing && item.toggleAttribute ? ` ${item.toggleAttribute}` : '';
    const checked = itemEnabled ? ' checked' : '';
    const disabled = editing ? '' : ' disabled';
    return `<label class="control-feature-toggle${editing ? ' control-feature-toggle-editing' : ' control-feature-toggle-readonly'}">
      <input type="checkbox"${interactive}${checked}${disabled} aria-label="${escapeHtml(itemLabel)} ${itemEnabled ? 'enabled' : 'disabled'}">
      <span class="control-feature-toggle-track" aria-hidden="true"></span>
      <span class="control-feature-toggle-copy">${itemEnabled ? 'Enabled' : 'Disabled'}</span>
    </label>`;
  }).join('');
  const edit = editing ? '' : `<button class="control-button control-button-primary" type="button"${editAttribute ? ` ${editAttribute}` : ''}>Edit settings</button>`;
  return `<div class="control-feature-header-actions">${edit}${toggles}</div>`;
}

export function navigationMarkup(model) {
  const primary = model.primary.map(domain => {
    const children = domain.children.map(child => `
      <a href="${child.path}" data-nav-path="${child.path}"${child.current ? ' aria-current="page"' : ''}>${escapeHtml(child.label)}</a>`).join('');
    return `<section class="control-nav-domain${domain.expanded ? ' control-nav-domain-open' : ''}${domain.current ? ' control-nav-domain-current' : ''}" data-domain="${domain.key}">
      <button type="button" data-domain-select="${domain.key}" aria-expanded="${domain.expanded ? 'true' : 'false'}">
        ${domain.current ? '<span class="control-nav-marker" aria-hidden="true"></span>' : ''}<span>${escapeHtml(domain.label)}</span>
      </button>
      <div class="control-nav-children"${domain.expanded ? '' : ' hidden'}>${children}</div>
    </section>`;
  }).join('');

  const secondary = model.secondary.map(item => `
    <a href="${item.path}" data-nav-path="${item.path}"${item.current ? ' aria-current="page"' : ''}>${escapeHtml(item.label)}</a>`).join('');

  return `<nav class="control-primary-nav" aria-label="Control destinations">${primary}</nav>
    <nav class="control-secondary-nav" aria-label="Control reference and history">${secondary}</nav>`;
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
