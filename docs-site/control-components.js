import { activityPageMarkup, commandsPageMarkup } from './control-secondary.js';

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\"', '&quot;')
    .replaceAll("'", '&#39;');
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
    return '<a class="control-login" href="/api/auth/start">Sign in with Discord</a>';
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
