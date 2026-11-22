// Shared shell for Control, Commands and Handbook: one top bar and one sidebar.
//
// The sidebar DOM is rendered once (it is static in each document) and never re-rendered
// on a mode change. Rail, peek and drawer are CSS states driven by data attributes.

import { controlIcon } from './control-icons.js?v=2';
import { destinationForPath, navGroupForPath } from './control-router.js?v=2';
import { installDrawerController, navigationModel } from './control-navigation.js?v=2';
import { installShellLayout, readNavPreference, writeNavPreference } from './control-shell-layout.js?v=3';
import { installNavHoverExpand } from './control-nav-hover.js?v=4';
import { installThemeControls } from './control-theme.js?v=2';
import {
  GUILD_STORAGE_KEY,
  accountRoleLine,
  installAccountMenu,
  installPopover,
  pickGuild,
  syncedLabel,
} from './control-account.js?v=2';
import { buildPaletteIndex, commandsFromMarkdown, installPalette } from './control-palette.js?v=1';

export const EXPANDED_KEY = 'rob-control-expanded-domain';
export const DOMAIN_ROUTE_KEY = 'rob-control-last-domain-routes';
const DEFAULT_GROUP = 'engagement';
const GROUP_KEYS = new Set(['engagement', 'publishing', 'support-safety', 'insights']);

const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

/* ---------- Pure: markup ---------- */

function flagMarkup() {
  return `<span class="control-nav-flag">${controlIcon('warning', { size: 14 })}<span class="sr-only">Needs attention</span></span>`;
}

function leafMarkup(child, groupKey, open) {
  return `<a class="control-nav-row control-nav-leaf" href="${escapeHtml(child.path)}" data-nav-path="${escapeHtml(child.path)}" data-nav-key="${escapeHtml(child.key)}" data-nav-group="${escapeHtml(groupKey)}"${open ? '' : ' tabindex="-1"'}${child.current ? ' aria-current="page"' : ''}><span class="control-nav-lbl">${escapeHtml(child.label)}</span>${child.flagged ? flagMarkup() : ''}</a>`;
}

function groupMarkup(group) {
  const open = Boolean(group.expanded);
  return `<div class="control-nav-group" data-domain="${escapeHtml(group.key)}" data-open="${open}">
<button type="button" class="control-nav-row" data-domain-select="${escapeHtml(group.key)}" aria-expanded="${open}" aria-controls="controlNavKids-${escapeHtml(group.key)}">${controlIcon(group.icon, { size: 16, className: 'control-nav-group-icon' })}<span class="control-nav-lbl">${escapeHtml(group.label)}</span>${group.flagged ? flagMarkup() : ''}${controlIcon('chevron', { size: 12, className: 'control-nav-chev' })}</button>
<div class="control-nav-kids" id="controlNavKids-${escapeHtml(group.key)}"><div>${group.children.map(child => leafMarkup(child, group.key, open)).join('')}</div></div>
</div>`;
}

function linkMarkup(item) {
  const match = item.matchDomain ? ` data-nav-match-domain="${escapeHtml(item.matchDomain)}"` : '';
  const external = item.external ? ' data-nav-external="true"' : '';
  return `<a class="control-nav-row" href="${escapeHtml(item.path)}" data-nav-path="${escapeHtml(item.path)}" data-nav-key="${escapeHtml(item.key)}"${match}${external}${item.current ? ' aria-current="page"' : ''}>${controlIcon(item.icon, { size: 16, className: 'control-nav-icon' })}<span class="control-nav-lbl">${escapeHtml(item.label)}</span>${item.flagged ? flagMarkup() : ''}</a>`;
}

// One markup for every mode: the rail is the same DOM with the labels faded out by CSS.
export function navigationMarkup(model) {
  const rows = model.items.map(item => {
    if (item.type === 'group') return groupMarkup(item);
    if (item.type === 'label') return `<p class="control-nav-label">${escapeHtml(item.label)}</p>`;
    return linkMarkup(item);
  }).join('\n');
  return `<span class="control-nav-indicator" data-nav-indicator aria-hidden="true"></span>\n${rows}`;
}

export function sidebarMarkup(model) {
  return `<aside id="controlNavDrawer" class="control-rail" aria-label="Control navigation">
<div class="control-panel">
<button id="controlNavClose" class="control-nav-close" type="button" aria-label="Close navigation">Close</button>
<nav id="controlNavContent" class="control-nav" aria-label="Control destinations">
${navigationMarkup(model)}
</nav>
</div>
</aside>`;
}

export function topbarMarkup() {
  return `<header class="control-topbar" id="controlTopbar">
<div class="control-topbar-lead">
<button id="controlNavToggle" class="control-icon-button control-nav-toggle" type="button" aria-label="Collapse navigation" title="Collapse navigation" aria-pressed="false">${controlIcon('sidebar-simple', { size: 18 })}</button>
<button id="controlMenuButton" class="control-icon-button control-menu-button" type="button" aria-controls="controlNavDrawer" aria-expanded="false" aria-label="Open navigation" title="Open navigation">${controlIcon('sidebar-simple', { size: 18 })}</button>
<button id="controlServerButton" class="control-server" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="controlServerMenu" hidden><span class="control-server-icon" aria-hidden="true"></span><span class="control-server-name"></span>${controlIcon('chevron', { size: 12, className: 'control-server-chev' })}</button>
</div>
<div class="control-topbar-main">
<button id="controlSearch" class="control-search" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="controlPalette" aria-label="Search">${controlIcon('search', { size: 16, className: 'control-search-icon' })}<span class="control-search-label">Search</span><kbd id="controlShortcut" aria-hidden="true">Ctrl K</kbd></button>
<span id="controlOffline" class="control-offline" hidden>${controlIcon('warning', { size: 16 })}<span>Rob-bot is offline. Saved changes apply when it reconnects.</span></span>
<div id="controlIdentity" class="control-identity">
<a id="controlLogin" class="control-login" href="/api/auth/start" hidden><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515c.074.134.144.273.21.416a18.27 18.27 0 0 0-5.356 0c.067-.143.137-.282.21-.416A19.74 19.74 0 0 0 3.678 4.37C.533 9.046-.321 13.58.106 18.058a19.9 19.9 0 0 0 5.994 3.03c.49-.669.927-1.383 1.302-2.134a12.93 12.93 0 0 1-2.058-.988c.172-.126.341-.255.505-.391 3.862 1.763 8.052 1.763 11.868 0 .165.136.333.265.505.391-.653.39-1.343.721-2.059.988.376.751.813 1.465 1.303 2.134a19.89 19.89 0 0 0 5.992-3.03c.501-5.177-.854-9.673-3.548-13.688ZM7.822 14.709c-1.171 0-2.139-1.076-2.139-2.397s.948-2.397 2.139-2.397c1.201 0 2.159 1.086 2.139 2.397 0 1.321-.948 2.397-2.139 2.397Zm7.457 0c-1.171 0-2.139-1.076-2.139-2.397s.948-2.397 2.139-2.397c1.201 0 2.159 1.086 2.139 2.397 0 1.321-.938 2.397-2.139 2.397Z"/></svg><span>Sign in with Discord</span></a>
<button id="controlAccountButton" class="control-account-button" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="controlAccountMenu" aria-label="Account" hidden><span class="control-avatar" aria-hidden="true"></span></button>
</div>
</div>
</header>`;
}

export function overlaysMarkup() {
  return `<div id="controlAccountMenu" class="control-pop" role="dialog" aria-label="Account" data-open="false" inert>
<div class="control-pop-who"><b id="controlAccountName"></b><span id="controlAccountRole"></span></div>
<div class="control-pop-row"><span id="controlAppearanceLabel">Appearance</span>
<div class="control-seg" role="group" aria-labelledby="controlAppearanceLabel"><span class="control-seg-thumb" aria-hidden="true"></span><button type="button" data-theme-choice="light" aria-pressed="false">Light</button><button type="button" data-theme-choice="dark" aria-pressed="false">Dark</button><button type="button" data-theme-choice="system" aria-pressed="true">Auto</button></div></div>
<button type="button" class="control-pop-item" data-account-sign-out>Sign out</button>
</div>
<div id="controlServerMenu" class="control-pop" role="menu" aria-label="Servers" data-open="false" inert>
<div id="controlServerList"></div>
<p id="controlServerSynced" class="control-pop-note"></p>
</div>
<div id="controlPalette" class="control-scrim" data-open="false" inert>
<div class="control-palette" role="dialog" aria-modal="true" aria-label="Search">
<input id="controlPaletteInput" type="text" role="combobox" aria-expanded="true" aria-controls="controlPaletteList" aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="Go to a page or find a command" aria-label="Search">
<ul id="controlPaletteList" role="listbox" aria-label="Results"></ul>
</div>
</div>
<div id="controlLive" class="sr-only" role="status" aria-live="polite"></div>`;
}

/* ---------- Pure: indicator target ---------- */

// rows: group rows {key, kind: 'group', open}, leaf rows {key, kind: 'leaf', group, current},
// link rows {key, kind: 'link', current}. Returns the key of the row that holds the indicator.
export function resolveIndicatorTarget(rows = []) {
  const current = rows.find(row => row.current);
  if (!current) return null;
  if (current.kind !== 'leaf') return current.key;
  const group = rows.find(row => row.kind === 'group' && row.key === current.group);
  return group && !group.open ? group.key : current.key;
}

/* ---------- DOM: indicator ---------- */

function indicatorRows(nav, { railClosed = false } = {}) {
  const rows = [];
  nav.querySelectorAll('.control-nav-group').forEach(group => {
    const key = group.dataset.domain;
    rows.push({ key, kind: 'group', group: key, open: group.dataset.open === 'true' && !railClosed, current: false });
    group.querySelectorAll('.control-nav-leaf').forEach(leaf => rows.push({
      key: leaf.dataset.navPath,
      kind: 'leaf',
      group: key,
      current: leaf.getAttribute('aria-current') === 'page',
    }));
  });
  nav.querySelectorAll('a.control-nav-row:not(.control-nav-leaf)').forEach(link => rows.push({
    key: link.dataset.navKey,
    kind: 'link',
    group: null,
    current: link.getAttribute('aria-current') === 'page',
  }));
  return rows;
}

function rowElement(nav, key) {
  if (!key) return null;
  return nav.querySelector(`[data-domain-select="${CSS.escape(key)}"]`)
    || nav.querySelector(`.control-nav-leaf[data-nav-path="${CSS.escape(key)}"]`)
    || nav.querySelector(`a.control-nav-row:not(.control-nav-leaf)[data-nav-key="${CSS.escape(key)}"]`);
}

export function installNavIndicator({ nav, isRailClosed = () => false, raf = globalThis.requestAnimationFrame?.bind(globalThis) } = {}) {
  const indicator = nav?.querySelector?.('[data-nav-indicator]');
  if (!indicator) return { place() {}, track() {}, destroy() {} };
  let tracking = false;

  const position = () => {
    const target = rowElement(nav, resolveIndicatorTarget(indicatorRows(nav, { railClosed: isRailClosed() })));
    if (!target) {
      indicator.classList.remove('on');
      return;
    }
    const top = target.getBoundingClientRect().top - nav.getBoundingClientRect().top + nav.scrollTop;
    indicator.style.transform = `translateY(${top}px)`;
    indicator.style.height = `${target.offsetHeight}px`;
    indicator.classList.add('on');
  };

  // Jump (animate = false) or slide (animate = true) to the current row.
  const place = (animate = false) => {
    if (tracking) return;
    if (!animate) indicator.dataset.motion = 'off';
    position();
    if (!animate) {
      void indicator.offsetWidth;
      delete indicator.dataset.motion;
    }
  };

  const accordionMoving = () => (nav.getAnimations?.({ subtree: true }) || [])
    .some(animation => animation.playState === 'running' && animation.transitionProperty === 'grid-template-rows');

  // While a grid-template-rows transition runs, sample the row each frame so the indicator follows it.
  const track = () => {
    if (tracking || !raf) {
      place(false);
      return;
    }
    tracking = true;
    indicator.dataset.motion = 'track';
    let settle = 0;
    const step = () => {
      position();
      if (accordionMoving() || settle++ < 2) raf(step);
      else {
        tracking = false;
        delete indicator.dataset.motion;
      }
    };
    raf(step);
  };

  return { place, track, destroy() {} };
}

/* ---------- Identity helpers (DOM) ---------- */

function readJson(storage, key) {
  try { return JSON.parse(storage?.getItem?.(key) || '') || {}; } catch { return {}; }
}

export function initialOpenGroup(currentPath, storedValue) {
  const owner = navGroupForPath(currentPath)?.key;
  if (owner) return owner;
  if (storedValue === 'none') return '';
  return GROUP_KEYS.has(storedValue) ? storedValue : DEFAULT_GROUP;
}

export async function loadShellSession(fetchImpl = globalThis.fetch) {
  try {
    const response = await fetchImpl('/api/session', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!response.ok) return { authenticated: false };
    return await response.json();
  } catch {
    return { authenticated: false };
  }
}

async function defaultSignOut(session) {
  if (!session?.authenticated || !session.csrf_token) return;
  const response = await fetch('/api/logout', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Rob-CSRF': session.csrf_token },
    body: '{}',
  });
  if (response.ok) location.reload();
}

function fillIcon(slot, name, iconUrl) {
  slot.replaceChildren();
  if (iconUrl) {
    const image = slot.ownerDocument.createElement('img');
    image.alt = '';
    image.src = iconUrl;
    slot.append(image);
  } else {
    slot.textContent = (name || '?').trim().slice(0, 1).toUpperCase();
  }
}

/* ---------- Shell installer ---------- */

export function installShell({
  doc = globalThis.document,
  win = globalThis.window,
  storage = globalThis.localStorage,
  currentPath = '/control',
  onNavigate = null,
  onSelectGuild = null,
  onSignOut = null,
  getLastByDomain = null,
  loadCommands = true,
} = {}) {
  const $ = id => doc.getElementById(id);
  const shell = doc.querySelector('.control-shell');
  const nav = $('controlNavContent');
  const rail = $('controlNavDrawer');
  const toggle = $('controlNavToggle');
  const menuButton = $('controlMenuButton');
  const closeButton = $('controlNavClose');
  const scrim = $('controlScrim');
  const main = $('controlMainWrap') || $('controlMain');
  const topbar = $('controlTopbar');
  if (!shell || !nav || !rail) return null;

  let navPreference = readNavPreference(storage);
  let session = null;
  let commandItems = [];
  let openGroup = initialOpenGroup(currentPath, storage?.getItem?.(EXPANDED_KEY));
  let current = currentPath;
  let flags = new Set();

  const modeOf = () => shell.dataset.navMode || 'expanded';
  const railClosed = () => modeOf() === 'rail' && shell.dataset.peek !== 'true';
  const indicator = installNavIndicator({ nav, isRailClosed: railClosed });

  /* Announcements */
  const live = $('controlLive');
  const announce = message => {
    if (!live) return;
    live.textContent = '';
    win.setTimeout(() => { live.textContent = message; }, 30);
  };

  /* Accordion */
  const setOpen = (key, { persist = true } = {}) => {
    openGroup = GROUP_KEYS.has(key) ? key : '';
    nav.querySelectorAll('.control-nav-group').forEach(group => {
      const open = group.dataset.domain === openGroup;
      group.dataset.open = String(open);
      group.querySelector('[data-domain-select]')?.setAttribute('aria-expanded', String(open));
      group.querySelectorAll('.control-nav-leaf').forEach(leaf => {
        if (open) leaf.removeAttribute('tabindex');
        else leaf.setAttribute('tabindex', '-1');
      });
    });
    if (persist) {
      try { storage?.setItem?.(EXPANDED_KEY, openGroup || 'none'); } catch { /* storage may be blocked */ }
    }
  };

  /* Current page */
  const setCurrent = (path, { animate = true } = {}) => {
    current = path;
    const lastByDomain = typeof getLastByDomain === 'function' ? getLastByDomain() : readJson(storage, DOMAIN_ROUTE_KEY);
    const model = navigationModel(destinationForPath(path) || { path }, openGroup || DEFAULT_GROUP, lastByDomain, { flags });
    const currentLeaves = new Set();
    const currentKeys = new Set();
    for (const item of model.items) {
      if (item.type === 'group') item.children.forEach(child => child.current && currentLeaves.add(child.path));
      else if (item.type === 'link') {
        if (item.current) currentKeys.add(item.key);
        const link = nav.querySelector(`a.control-nav-row:not(.control-nav-leaf)[data-nav-key="${CSS.escape(item.key)}"]`);
        if (link && item.key === 'resources') {
          link.setAttribute('href', item.path);
          link.dataset.navPath = item.path;
        }
      }
    }
    nav.querySelectorAll('a.control-nav-row').forEach(link => {
      const isLeaf = link.classList.contains('control-nav-leaf');
      const active = isLeaf ? currentLeaves.has(link.dataset.navPath) : currentKeys.has(link.dataset.navKey);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const owner = navGroupForPath(path)?.key;
    const before = openGroup;
    if (owner) setOpen(owner);
    if (owner && owner !== before) indicator.track();
    else indicator.place(animate);
    syncPaletteIndex();
  };

  /* Flags: a feature with a problem shows a warning icon at the row end. */
  const syncFlag = (row, flagged) => {
    if (!row) return;
    const existing = row.querySelector(':scope > .control-nav-flag');
    if (!flagged) { existing?.remove(); return; }
    if (existing) return;
    const anchor = row.querySelector(':scope > .control-nav-chev');
    if (anchor) anchor.insertAdjacentHTML('beforebegin', flagMarkup());
    else row.insertAdjacentHTML('beforeend', flagMarkup());
  };
  const setFlags = paths => {
    flags = paths instanceof Set ? paths : new Set(paths || []);
    const lastByDomain = typeof getLastByDomain === 'function' ? getLastByDomain() : readJson(storage, DOMAIN_ROUTE_KEY);
    const model = navigationModel(destinationForPath(current) || { path: current }, openGroup || DEFAULT_GROUP, lastByDomain, { flags });
    for (const item of model.items) {
      if (item.type === 'group') {
        syncFlag(nav.querySelector(`[data-domain-select="${CSS.escape(item.key)}"]`), item.flagged);
        item.children.forEach(child => syncFlag(nav.querySelector(`a.control-nav-leaf[data-nav-key="${CSS.escape(child.key)}"]`), child.flagged));
      } else if (item.type === 'link') {
        syncFlag(nav.querySelector(`a.control-nav-row:not(.control-nav-leaf)[data-nav-key="${CSS.escape(item.key)}"]`), item.flagged);
      }
    }
  };

  nav.addEventListener('click', event => {
    const groupButton = event.target.closest?.('[data-domain-select]');
    if (groupButton) {
      const key = groupButton.dataset.domainSelect;
      setOpen(openGroup === key ? '' : key);
      indicator.track();
      return;
    }
    const link = event.target.closest?.('a[data-nav-path]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button) return;
    const href = link.getAttribute('href') || '';
    if (onNavigate && href.startsWith('/control')) {
      event.preventDefault();
      onNavigate(href);
    }
    if (modeOf() === 'drawer') drawer.close({ restoreFocus: false });
  });

  /* Layout, rail toggle, peek */
  const syncChrome = () => {
    const mode = modeOf();
    const collapsed = mode === 'rail';
    const label = collapsed ? 'Expand navigation' : 'Collapse navigation';
    toggle?.setAttribute('aria-label', label);
    toggle?.setAttribute('title', label);
    toggle?.setAttribute('aria-pressed', String(collapsed));
    if (mode !== 'rail') shell.dataset.peek = 'false';
    drawer.sync();
    indicator.track();
  };

  let booted = false;
  const layout = installShellLayout({
    shell,
    target: win,
    getWidth: () => doc.documentElement.clientWidth,
    getPreference: () => navPreference,
    onChange: () => { if (booted) syncChrome(); },
  });

  toggle?.addEventListener('click', () => {
    const mode = modeOf();
    if (mode === 'drawer') return;
    navPreference = mode === 'rail' ? 'expanded' : 'collapsed';
    writeNavPreference(storage, navPreference);
    shell.dataset.peek = 'false';
    hover.reset();
    layout.refresh();
    syncChrome();
  });

  const setPeek = value => {
    shell.dataset.peek = String(value);
    indicator.track();
  };
  const hover = installNavHoverExpand({
    rail,
    getMode: modeOf,
    isHoverCapable: () => win.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches ?? true,
    hasFocusInside: () => rail.contains(doc.activeElement),
    expand: () => setPeek(true),
    collapse: () => setPeek(false),
  });
  rail.addEventListener('focusin', () => {
    if (modeOf() === 'rail' && shell.dataset.peek !== 'true') hover.open();
  });

  /* Drawer */
  const drawer = installDrawerController({
    drawer: rail,
    trigger: menuButton,
    closeButton,
    isDrawer: () => modeOf() === 'drawer',
    background: () => [main, topbar],
    onOpen: () => { if (scrim) scrim.dataset.open = 'true'; },
    onClose: () => { if (scrim) scrim.dataset.open = 'false'; },
  });
  scrim?.addEventListener('click', () => drawer.close());

  /* Theme */
  const themeRemove = installThemeControls({
    root: doc.documentElement,
    buttons: [...doc.querySelectorAll('[data-theme-choice]')],
    media: win.matchMedia('(prefers-color-scheme: dark)'),
    storage,
    themeColor: doc.querySelector('meta[name="theme-color"]'),
  });

  /* Menus */
  let serverPopover = null;
  const accountMenu = installAccountMenu({
    trigger: $('controlAccountButton'),
    menu: $('controlAccountMenu'),
    signOut: doc.querySelector('[data-account-sign-out]'),
    doc,
    onSignOut: () => (onSignOut ? onSignOut(session) : defaultSignOut(session)),
    onOpen: () => serverPopover?.close(),
  });
  serverPopover = installPopover({
    trigger: $('controlServerButton'),
    menu: $('controlServerMenu'),
    align: 'left',
    doc,
    onOpen: () => accountMenu.close(),
  });
  $('controlServerMenu')?.addEventListener('click', event => {
    const item = event.target.closest?.('[data-guild-id]');
    if (!item) return;
    serverPopover.close({ restoreFocus: true });
    const id = item.dataset.guildId;
    if (id === String(currentGuildId)) return;
    try { storage?.setItem?.(GUILD_STORAGE_KEY, id); } catch { /* storage may be blocked */ }
    if (onSelectGuild) onSelectGuild(id);
    else win.location.assign('/control');
  });

  /* Palette */
  const destinationsFromNav = () => {
    const entries = [];
    const lastByDomain = typeof getLastByDomain === 'function' ? getLastByDomain() : readJson(storage, DOMAIN_ROUTE_KEY);
    const model = navigationModel(destinationForPath(current) || { path: current }, openGroup || DEFAULT_GROUP, lastByDomain, { flags });
    let group = '';
    for (const item of model.items) {
      if (item.type === 'group') item.children.forEach(child => entries.push({ label: child.label, path: child.path, group: item.label }));
      else if (item.type === 'label') group = item.label;
      else entries.push({ label: item.label, path: item.path, group: item.external || item.key !== 'resources' ? group : '' });
    }
    return entries;
  };
  let paletteIndex = buildPaletteIndex({ destinations: destinationsFromNav(), commands: commandItems });
  function syncPaletteIndex() {
    paletteIndex = buildPaletteIndex({ destinations: destinationsFromNav(), commands: commandItems });
  }
  const palette = installPalette({
    scrim: $('controlPalette'),
    input: $('controlPaletteInput'),
    list: $('controlPaletteList'),
    trigger: $('controlSearch'),
    shortcutTarget: doc,
    getIndex: () => paletteIndex,
    background: () => [main, topbar, rail],
    doc,
    onSelect: item => {
      if (onNavigate && item.href.startsWith('/control')) onNavigate(item.href);
      else win.location.assign(item.href);
    },
  });
  const shortcut = $('controlShortcut');
  if (shortcut && /Mac|iPhone|iPad/.test(win.navigator?.platform || win.navigator?.userAgent || '')) shortcut.textContent = '⌘K';
  if (loadCommands && typeof win.fetch === 'function') {
    win.fetch('/commands.md?v=1', { cache: 'no-cache' })
      .then(response => (response.ok ? response.text() : ''))
      .then(text => {
        commandItems = commandsFromMarkdown(text);
        syncPaletteIndex();
      })
      .catch(() => {});
  }

  /* Identity */
  let currentGuildId = null;
  const renderIdentity = ({ session: nextSession, guild = null } = {}) => {
    session = nextSession || null;
    const signedIn = Boolean(session?.authenticated);
    const login = $('controlLogin');
    const account = $('controlAccountButton');
    const server = $('controlServerButton');
    if (login) login.hidden = signedIn;
    if (account) account.hidden = !signedIn;
    currentGuildId = guild?.id ?? null;
    if (server) server.hidden = !signedIn || !guild;
    if (!signedIn) {
      setOffline(false);
      return;
    }
    const name = session.user?.name || 'Discord user';
    const avatar = account.querySelector('.control-avatar');
    fillIcon(avatar, name, session.user?.avatar_url);
    account.setAttribute('aria-label', `Account, ${name}`);
    $('controlAccountName').textContent = name;
    $('controlAccountRole').textContent = accountRoleLine(guild);
    if (guild) {
      fillIcon(server.querySelector('.control-server-icon'), guild.name, guild.icon_url);
      server.querySelector('.control-server-name').textContent = guild.name;
    }
    const list = $('controlServerList');
    list.replaceChildren(...(session.guilds || []).map(item => {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'control-pop-item';
      button.setAttribute('role', 'menuitemradio');
      button.setAttribute('aria-checked', String(String(item.id) === String(currentGuildId)));
      button.dataset.guildId = String(item.id);
      const icon = doc.createElement('span');
      icon.className = 'control-server-icon';
      icon.setAttribute('aria-hidden', 'true');
      fillIcon(icon, item.name, item.icon_url);
      const label = doc.createElement('span');
      label.textContent = item.name;
      button.append(icon, label);
      return button;
    }));
    $('controlServerSynced').textContent = syncedLabel(guild?.snapshot_updated_at);
    setOffline(guild?.online === false);
  };

  function setOffline(offline) {
    const notice = $('controlOffline');
    if (!notice) return;
    const changed = notice.hidden === Boolean(offline);
    notice.hidden = !offline;
    if (offline && changed) announce('Rob-bot is offline. Saved changes apply when it reconnects.');
  }

  /* Boot */
  const motionOn = () => { delete shell.dataset.motion; };
  setOpen(openGroup, { persist: false });
  setCurrent(currentPath, { animate: false });
  booted = true;
  syncChrome();
  win.requestAnimationFrame?.(() => win.requestAnimationFrame?.(motionOn));
  doc.fonts?.ready?.then?.(() => indicator.place(false));
  win.addEventListener('resize', () => indicator.place(false));

  return {
    shell,
    nav,
    setCurrent,
    setFlags,
    setOpen,
    announce,
    renderIdentity,
    setOffline,
    closeDrawer: options => drawer.close(options),
    refreshLayout: () => layout.refresh(),
    openPalette: () => palette.open(),
    indicator,
    drawer,
    destroy() {
      hover.destroy();
      layout.destroy();
      palette.destroy();
      accountMenu.destroy();
      serverPopover.destroy();
      themeRemove?.();
    },
  };
}
