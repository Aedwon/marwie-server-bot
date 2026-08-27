export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function navigationMarkup(model) {
  const primary = model.primary.map(domain => {
    if (domain.direct) {
      return `<a class="control-nav-direct" href="${domain.path}"${domain.current ? ' aria-current="page"' : ''}>${escapeHtml(domain.label)}</a>`;
    }
    const children = domain.children.map(child => `
      <a href="${child.path}"${child.current ? ' aria-current="page"' : ''}>${escapeHtml(child.label)}</a>`).join('');
    return `<section class="control-nav-domain" data-domain="${domain.key}">
      <button type="button" data-domain-select="${domain.key}" aria-expanded="${domain.expanded ? 'true' : 'false'}">
        <span>${escapeHtml(domain.label)}</span><span aria-hidden="true">⌄</span>
      </button>
      <div class="control-nav-children"${domain.expanded ? '' : ' hidden'}>${children}</div>
    </section>`;
  }).join('');

  const secondary = model.secondary.map(item => `
    <a href="${item.path}"${item.current ? ' aria-current="page"' : ''}>${escapeHtml(item.label)}</a>`).join('');

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
  return `<div class="control-context">
      <span class="control-guild-name">${escapeHtml(guild?.name || 'Rob-bot server')}</span>
      <span class="control-user">${avatar}<span>${escapeHtml(session.user?.name || 'Discord user')}</span></span>
    </div>`;
}

export function pageMarkup(destination, { authenticated = false, state = null, snapshot = null } = {}) {
  if (!authenticated) {
    return `<section class="control-empty"><h1>${escapeHtml(destination.label)}</h1><p>Sign in with Discord to load Control.</p><a class="control-primary-button" href="/api/auth/start">Sign in with Discord</a></section>`;
  }

  if (destination.path === '/control/commands') {
    return `<section class="control-page-section"><h1>Commands</h1><p>Slash-command administration remains documented in the canonical command manual.</p><p><a href="/commands">Open Commands</a></p></section>`;
  }
  if (destination.path === '/control/activity') {
    return `<section class="control-page-section"><h1>Activity</h1><p data-foundation-placeholder>Administrative history uses the existing durable Control action audit trail. The final Activity UI is intentionally deferred.</p></section>`;
  }

  const health = snapshot?.fresh ? 'Fresh server state' : 'Server state unavailable';
  return `<section class="control-page-section" data-page-key="${escapeHtml(destination.path)}">
    <div class="control-page-heading"><div><p class="control-eyebrow">${escapeHtml(destination.domain || 'Control')}</p><h1>${escapeHtml(destination.label)}</h1></div><span class="control-state-chip">${escapeHtml(health)}</span></div>
    <p class="control-page-intro">This Foundation route is live against the existing Control read boundary. Its domain editor is intentionally left to the assigned migration wave.</p>
    <div class="control-read-summary" aria-label="Foundation read state">
      <p><strong>Rob-bot:</strong> ${state?.bot?.online ? 'online' : 'status unavailable'}</p>
      <p><strong>Snapshot:</strong> ${escapeHtml(snapshot?.updated_at || 'not loaded')}</p>
    </div>
  </section>`;
}
