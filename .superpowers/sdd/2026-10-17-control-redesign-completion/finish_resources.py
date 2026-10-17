from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]

p = ROOT / 'docs-site/control-mappings.js'
s = p.read_text()
marker = 'export function mappingPageMarkup({ pageKey, state, snapshot } = {}) {'
assert marker in s
if 'function resourcesTabsMarkup' not in s:
    tabs = '''function resourcesTabsMarkup(pageKey) {
  const items = [
    ['/control/mappings/channels', 'Channels'],
    ['/control/mappings/roles', 'Roles'],
    ['/control/mappings/categories', 'Categories'],
  ];
  return `<nav class="mapping-resource-tabs" aria-label="Resource types">${items.map(([path, label]) => `<a href="${path}" data-nav-path="${path}"${path === pageKey ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>`;
}

'''
    s = s.replace(marker, tabs + marker, 1)

s = s.replace(
    '<section class="control-page mapping-page"><h1>${escapeHtml(config.title)}</h1><p>Load current server state to manage these mappings.</p></section>',
    '<section class="control-page mapping-page"><h1>Resources</h1>${resourcesTabsMarkup(pageKey)}<h2>${escapeHtml(config.title)}</h2><p>Load current server state to manage these Discord resources.</p></section>',
)
s = s.replace(
    '<div><h1>${escapeHtml(config.title)}</h1><p>Choose current Discord resources, then save all changes together.</p></div>',
    '<div><h1>Resources</h1><p>Choose current Discord resources, then save all changes together.</p></div>\n        ${resourcesTabsMarkup(pageKey)}\n        <h2 class="mapping-resource-heading">${escapeHtml(config.title)}</h2>',
    1,
)
s = s.replace(
    '<div><h1>${escapeHtml(config.title)}</h1><p>Current Discord resources and their connection health.</p></div>',
    '<div><h1>Resources</h1><p>Current Discord resources and their connection health.</p></div>\n        ${resourcesTabsMarkup(pageKey)}\n        <h2 class="mapping-resource-heading">${escapeHtml(config.title)}</h2>',
    1,
)
s = s.replace(
    'Review only the resources owned by Mappings. Nothing is changed until you apply the reviewed plan.',
    'Review suggested Discord resources. Nothing changes until you apply the reviewed plan.',
)
p.write_text(s)

p = ROOT / 'docs-site/control-mappings.css'
c = p.read_text()
if '.mapping-resource-tabs' not in c:
    c += '''

.mapping-resource-tabs {
  display: flex;
  gap: 4px;
  margin: 18px 0 22px;
  padding-bottom: 1px;
  border-bottom: 1px solid var(--stroke-subtle);
}

.mapping-resource-tabs a {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  padding: 0 10px;
  border-radius: 9px 9px 0 0;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
}

.mapping-resource-tabs a:hover {
  color: var(--text-primary);
  background: var(--surface-secondary);
}

.mapping-resource-tabs a[aria-current="page"] {
  color: var(--text-primary);
  box-shadow: inset 0 -2px 0 var(--text-primary);
}

.mapping-resource-heading {
  margin: 0 0 14px;
  font-size: 20px;
  line-height: 1.25;
  font-weight: 600;
}

@media (max-width: 639px) {
  .mapping-resource-tabs { overflow-x: auto; }
  .mapping-resource-tabs a { min-height: 44px; }
}
'''
p.write_text(c)
print('Resources surface completed')
