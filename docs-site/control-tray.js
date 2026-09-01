import { escapeHtml } from './control-components.js';

const DOMAIN_LABELS = {
  community: 'Community',
  content: 'Content',
  utilities: 'Utilities',
  mappings: 'Mappings',
  analytics: 'Analytics',
  workflows: 'Workflows',
};

export function dirtyPageGroups(dirtyPages = []) {
  const counts = new Map();
  for (const pageKey of dirtyPages) {
    const parts = String(pageKey || '').split('/').filter(Boolean);
    const domain = parts[1] || 'other';
    const label = DOMAIN_LABELS[domain] || 'Other';
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count }));
}

export function nextTrayExpandedState(current, action) {
  if (action === 'expand') return true;
  if (action === 'minimize') return false;
  return Boolean(current);
}

function statusTone(tone) {
  if (tone === 'good' || tone === 'bad') return tone;
  return 'neutral';
}

export function changesTrayMarkup({ expanded = false, status = {}, dirtyPages = [] } = {}) {
  const count = dirtyPages.length;
  const countLabel = `${count} pending change${count === 1 ? '' : 's'}`;
  const tone = statusTone(status.tone);
  const message = status.message || 'Server state has not loaded yet.';

  if (!expanded) {
    return `<button class="control-changes-tray control-changes-tray-compact" type="button" data-control-tray-expand aria-expanded="false" aria-label="Open changes tray. ${escapeHtml(countLabel)}. ${escapeHtml(message)}">
      <span class="control-tray-server-dot" data-tone="${tone}" aria-hidden="true"></span>
      <span>${escapeHtml(countLabel)}</span>
    </button>`;
  }

  const groups = dirtyPageGroups(dirtyPages);
  const groupMarkup = groups.length
    ? groups.map(group => `<div class="control-tray-group"><span>${escapeHtml(group.label)}</span><strong>${group.count}</strong></div>`).join('')
    : '<p class="control-tray-empty">No unsaved changes.</p>';

  return `<section class="control-changes-tray control-changes-tray-expanded" aria-label="Control changes">
    <header class="control-tray-header">
      <strong>Changes</strong>
      <button class="control-tray-minimize" type="button" data-control-tray-minimize aria-label="Minimize changes tray">−</button>
    </header>
    <div class="control-tray-server">
      <span class="control-tray-server-dot" data-tone="${tone}" aria-hidden="true"></span>
      <span>${escapeHtml(message)}</span>
    </div>
    <div class="control-tray-summary" aria-label="Unsaved changes by Control section">${groupMarkup}</div>
    <div class="control-tray-actions">
      <button class="control-button control-button-primary" type="button" data-control-tray-save-all disabled title="Bulk save execution is not enabled yet. Save from each edited page.">Save all changes</button>
    </div>
  </section>`;
}

export function createChangesTrayController({ root, getDirtyPages = () => [] } = {}) {
  if (!root?.addEventListener) {
    return { setStatus() {}, render() {}, destroy() {}, get expanded() { return false; } };
  }
  let expanded = false;
  let status = { message: 'Server state has not loaded yet.', tone: 'neutral' };

  const render = () => {
    root.innerHTML = changesTrayMarkup({ expanded, status, dirtyPages: getDirtyPages() || [] });
    root.dataset.expanded = String(expanded);
  };

  const onClick = event => {
    let action = 'content';
    if (event.target?.closest?.('[data-control-tray-expand]')) action = 'expand';
    else if (event.target?.closest?.('[data-control-tray-minimize]')) action = 'minimize';
    const next = nextTrayExpandedState(expanded, action);
    if (next !== expanded) {
      expanded = next;
      render();
    }
  };

  root.addEventListener('click', onClick);
  render();
  return {
    setStatus(message, tone = '') {
      status = { message: message || '', tone: statusTone(tone) };
      render();
    },
    render,
    destroy() { root.removeEventListener('click', onClick); },
    get expanded() { return expanded; },
  };
}
