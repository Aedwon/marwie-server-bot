// Command palette: pure index and filtering, plus the DOM installer.

const COMMAND_HINT = 'Command';
const DEFAULT_LIMIT = 9;

export function plainHeading(value) {
  return String(value ?? '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim();
}

export function slug(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/^\//, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

// Level-2 headings that start with a slash are commands. Ids match the Commands page.
export function commandsFromMarkdown(markdown) {
  const counts = new Map();
  const commands = [];
  let skippedTitle = false;
  for (const line of String(markdown ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const match = line.match(/^(#{1,5})\s+(.*)$/);
    if (!match) continue;
    const level = match[1].length;
    const plain = plainHeading(match[2]);
    if (level === 1 && !skippedTitle && plain.toLowerCase() === 'rob-bot command manual') {
      skippedTitle = true;
      continue;
    }
    let base = `manual-${slug(plain)}`;
    let command = false;
    if (level === 1) base = `section-${slug(plain)}`;
    else if (level === 2 && plain.startsWith('/')) {
      base = `command-${slug(plain)}`;
      command = true;
    }
    const seen = counts.get(base) || 0;
    counts.set(base, seen + 1);
    if (command) commands.push({ name: plain, id: seen === 0 ? base : `${base}-${seen + 1}` });
  }
  return commands;
}

export function buildPaletteIndex({ destinations = [], commands = [] } = {}) {
  const entries = destinations.map(item => ({
    kind: 'destination',
    label: item.label,
    hint: item.group || '',
    href: item.path,
  }));
  commands.forEach(command => entries.push({
    kind: 'command',
    label: command.name,
    hint: COMMAND_HINT,
    href: `/commands#${command.id}`,
  }));
  return entries.map((entry, order) => ({
    ...entry,
    order,
    haystack: `${entry.label} ${entry.hint}`.toLowerCase().replace(/(^|\s)\//g, '$1'),
    start: entry.label.toLowerCase().replace(/^\//, ''),
  }));
}

export function filterPalette(index, query, { limit = DEFAULT_LIMIT } = {}) {
  const terms = String(query ?? '').toLowerCase().trim().replace(/(^|\s)\//g, '$1').split(/\s+/).filter(Boolean);
  if (!terms.length) return index.slice(0, limit);
  return index
    .filter(item => terms.every(term => item.haystack.includes(term)))
    .map(item => ({ item, rank: item.start.startsWith(terms[0]) ? 0 : 1 }))
    .sort((left, right) => left.rank - right.rank || left.item.order - right.item.order)
    .slice(0, limit)
    .map(entry => entry.item);
}

export function paletteKeyAction({ key, index = 0, count = 0 } = {}) {
  if (key === 'Escape') return { index, action: 'close' };
  if (!count) return { index, action: 'none' };
  if (key === 'ArrowDown') return { index: (index + 1) % count, action: 'move' };
  if (key === 'ArrowUp') return { index: (index - 1 + count) % count, action: 'move' };
  if (key === 'Home') return { index: 0, action: 'move' };
  if (key === 'End') return { index: count - 1, action: 'move' };
  if (key === 'Enter') return { index, action: 'open' };
  return { index, action: 'none' };
}

const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

export function paletteListMarkup(items, selected) {
  if (!items.length) return '<li class="control-palette-empty" role="presentation">No matches</li>';
  return items.map((item, position) => `<li id="controlPaletteOption${position}" role="option" aria-selected="${position === selected}" data-palette-index="${position}"><span class="control-palette-label${item.kind === 'command' ? ' control-palette-command' : ''}">${escapeHtml(item.label)}</span><span class="control-palette-hint">${escapeHtml(item.hint)}</span></li>`).join('');
}

export function installPalette({
  scrim,
  input,
  list,
  trigger = null,
  shortcutTarget = null,
  getIndex,
  onSelect,
  background = [],
  doc = globalThis.document,
} = {}) {
  if (!scrim || !input || !list) return { open() {}, close() {}, destroy() {} };
  let items = [];
  let selected = 0;
  let opener = null;
  let open = false;
  const backgroundItems = () => [...(typeof background === 'function' ? background() : background)].filter(Boolean);

  const render = () => {
    items = filterPalette(getIndex?.() || [], input.value);
    selected = Math.min(selected, Math.max(0, items.length - 1));
    list.innerHTML = paletteListMarkup(items, selected);
    input.setAttribute('aria-activedescendant', items.length ? `controlPaletteOption${selected}` : '');
    list.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' });
  };

  const close = ({ restoreFocus = true } = {}) => {
    if (!open) return;
    open = false;
    scrim.dataset.open = 'false';
    scrim.inert = true;
    trigger?.setAttribute?.('aria-expanded', 'false');
    backgroundItems().forEach(item => { item.inert = false; });
    if (restoreFocus) (opener || trigger)?.focus?.();
    opener = null;
  };

  const openPalette = () => {
    if (open) return;
    open = true;
    opener = doc?.activeElement || trigger;
    input.value = '';
    selected = 0;
    render();
    scrim.inert = false;
    scrim.dataset.open = 'true';
    trigger?.setAttribute?.('aria-expanded', 'true');
    backgroundItems().forEach(item => { item.inert = true; });
    input.focus();
  };

  const choose = position => {
    const item = items[position];
    if (!item) return;
    close({ restoreFocus: false });
    onSelect?.(item);
  };

  const onInput = () => { selected = 0; render(); };
  const onKeyDown = event => {
    const result = paletteKeyAction({ key: event.key, index: selected, count: items.length });
    if (result.action === 'none') return;
    event.preventDefault();
    if (result.action === 'close') close();
    else if (result.action === 'open') choose(result.index);
    else { selected = result.index; render(); }
  };
  const onListClick = event => {
    const row = event.target?.closest?.('[data-palette-index]');
    if (row) choose(Number(row.dataset.paletteIndex));
  };
  const onScrimClick = event => { if (event.target === scrim) close(); };
  const onShortcut = event => {
    if ((event.metaKey || event.ctrlKey) && !event.altKey && String(event.key || '').toLowerCase() === 'k') {
      event.preventDefault();
      if (open) close(); else openPalette();
    }
  };

  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onKeyDown);
  list.addEventListener('click', onListClick);
  scrim.addEventListener('click', onScrimClick);
  trigger?.addEventListener?.('click', openPalette);
  (shortcutTarget || doc)?.addEventListener?.('keydown', onShortcut);
  scrim.inert = true;

  return {
    open: openPalette,
    close,
    isOpen: () => open,
    destroy() {
      input.removeEventListener('input', onInput);
      input.removeEventListener('keydown', onKeyDown);
      list.removeEventListener('click', onListClick);
      scrim.removeEventListener('click', onScrimClick);
      trigger?.removeEventListener?.('click', openPalette);
      (shortcutTarget || doc)?.removeEventListener?.('keydown', onShortcut);
    },
  };
}
