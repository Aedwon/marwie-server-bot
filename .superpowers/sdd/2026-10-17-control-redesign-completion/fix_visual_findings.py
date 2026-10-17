from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]

# 1. Notification roles read mode: responsive semantic summaries instead of wide tables.
p = ROOT / 'docs-site/control-utilities.js'
s = p.read_text()
a = s.index('function notificationRead(state, snapshot) {')
b = s.index('function notificationButtonRows', a)
new = '''function notificationRead(state, snapshot) {
  const panel = state.persisted;
  if (!panel.title && !panel.description && !panel.buttons.length) {
    return '<p class="utility-empty">No notification role panel is configured.</p>';
  }
  const roles = new Map((snapshot?.roles || []).map(role => [String(role.id), role]));
  const buttons = panel.buttons.map(item => {
    const role = roles.get(String(item.role_id));
    return `<article class="utility-notification-button-summary"><strong>${escapeHtml(item.label)}</strong><dl><div><dt>Role</dt><dd>${escapeHtml(role?.name || `Role ${item.role_id}`)}</dd></div><div><dt>Emoji</dt><dd>${escapeHtml(item.emoji || 'None')}</dd></div><div><dt>Style</dt><dd>${escapeHtml(item.style)}</dd></div></dl></article>`;
  }).join('');
  return `
    <dl class="utility-panel-summary-list">
      <div><dt>Title</dt><dd>${escapeHtml(panel.title || 'Not configured')}</dd></div>
      <div><dt>Description</dt><dd>${escapeHtml(panel.description || 'Not configured')}</dd></div>
    </dl>
    ${panel.buttons.length ? `<div class="utility-subheading"><h3>Buttons</h3><p>${panel.buttons.length} configured self-role button${panel.buttons.length === 1 ? '' : 's'}.</p></div><div class="utility-notification-button-list">${buttons}</div>` : ''}`;
}

'''
s = s[:a] + new + s[b:]
p.write_text(s)

# 2. Resources tabs already name the resource type. Remove duplicate subtype headings.
p = ROOT / 'docs-site/control-mappings.js'
s = p.read_text()
s = s.replace('\n        <h2 class="mapping-resource-heading">${escapeHtml(config.title)}</h2>', '')
p.write_text(s)

p = ROOT / 'web-tests/control-mappings.test.js'
s = p.read_text()
s = s.replace(
    '  assert.match(readMarkup, /<h2 class="mapping-resource-heading">Channels<\\/h2>/);\n',
    '  assert.doesNotMatch(readMarkup, /mapping-resource-heading/);\n',
)
p.write_text(s)

# 3. Playbook links own their current-route indicator in initial markup.
p = ROOT / 'docs-site/control-components.js'
s = p.read_text()
old = '''  const secondary = model.secondary.map(item => `
    <a href="${item.path}" data-nav-path="${item.path}">${escapeHtml(item.label)}</a>`).join('');'''
new = '''  const secondary = model.secondary.map(item => `
    <a href="${item.path}" data-nav-path="${item.path}"${item.current ? ' aria-current="page"' : ''}>${escapeHtml(item.label)}</a>`).join('');'''
assert old in s
s = s.replace(old, new, 1)
p.write_text(s)

# 4. Shell / responsive polish.
p = ROOT / 'docs-site/control.css'
c = p.read_text()
marker = '/* Final visual-review responsive fixes */'
if marker not in c:
    c += '''

/* Final visual-review responsive fixes */
.control-nav-domain-open > button { background: transparent; }
.control-nav-domain-current > button { background: color-mix(in srgb, currentColor 5.5%, transparent); }
.control-commands-page,
.control-activity-page { border-top: 0; padding-top: 0; }
.utility-panel-summary-list { margin: 0; display: grid; gap: 0; }
.utility-panel-summary-list > div { display: grid; grid-template-columns: minmax(110px, .32fr) minmax(0, 1fr); gap: 18px; padding: 11px 0; border-bottom: 1px solid var(--stroke-subtle); }
.utility-panel-summary-list > div:last-child { border-bottom: 0; }
.utility-panel-summary-list dt { font-size: 14px; line-height: 1.4; font-weight: 600; }
.utility-panel-summary-list dd { margin: 0; min-width: 0; overflow-wrap: anywhere; color: var(--text-secondary); font-size: 14px; line-height: 1.5; }
.utility-notification-button-list { display: grid; gap: 0; }
.utility-notification-button-summary { display: grid; grid-template-columns: minmax(120px, .34fr) minmax(0, 1fr); gap: 18px; padding: 12px 0; border-bottom: 1px solid var(--stroke-subtle); }
.utility-notification-button-summary:last-child { border-bottom: 0; }
.utility-notification-button-summary > strong { min-width: 0; overflow-wrap: anywhere; font-size: 14px; font-weight: 600; }
.utility-notification-button-summary dl { margin: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.utility-notification-button-summary dl > div { min-width: 0; }
.utility-notification-button-summary dt { color: var(--text-tertiary); font-size: 13px; line-height: 1.3; }
.utility-notification-button-summary dd { margin: 3px 0 0; min-width: 0; overflow-wrap: anywhere; color: var(--text-secondary); font-size: 14px; line-height: 1.4; }
.control-changes-tray-mount { max-width: calc(100vw - 24px); }
.control-changes-tray-compact { max-width: 100%; white-space: nowrap; }
@media (min-width: 900px) and (max-width: 1199px) {
  .control-shell:has(.control-context-shell[data-open="true"]:not([hidden])) .control-main { padding-right: calc(var(--control-right-width) + 28px); }
}
@media (max-width: 639px) {
  .utility-panel-summary-list > div,
  .utility-notification-button-summary { grid-template-columns: 1fr; gap: 5px; }
  .utility-notification-button-summary dl { grid-template-columns: 1fr; gap: 8px; }
  .utility-notification-button-summary dl > div { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 8px; align-items: baseline; }
  .utility-notification-button-summary dd { margin-top: 0; }
  .control-changes-tray-mount { left: 12px; right: 12px; bottom: max(12px, env(safe-area-inset-bottom)); display: flex; justify-content: flex-end; max-width: none; }
  .control-changes-tray { max-width: 100%; }
  .control-context-shell { inset: 0 !important; width: 100vw !important; max-width: none !important; height: 100dvh !important; border-radius: 0 !important; }
  .control-context-close { display: inline-flex !important; align-items: center; justify-content: center; }
}
'''
p.write_text(c)

# 5. The visual harness must use the actual Activity projection shape.
p = ROOT / '.visual-companion/control-completion-review/review.js'
s = p.read_text()
old = '''const activityState = { status: 'loaded', items: [
  { id: '1', created_at: '2026-10-17T08:10:00Z', summary: 'Announcement published', detail: 'Posted in #announcements' },
  { id: '2', created_at: '2026-10-17T07:35:00Z', summary: 'Ticket configuration updated', detail: 'Support ticket type changed' },
], cursor: null, hasMore: false };'''
new = '''const activityState = { phase: 'ready', actorId: '42', items: [
  { id: '1', timestamp: '2026-10-17T08:10:00Z', summary: 'Published an announcement to #announcements', status: 'completed', actor: { id: '42' } },
  { id: '2', timestamp: '2026-10-17T07:35:00Z', summary: 'Updated ticket configuration', status: 'completed', actor: { id: '77' } },
], nextCursor: null, error: null, loadingMore: false };'''
assert old in s
p.write_text(s.replace(old, new, 1))

print('visual findings fixed')
