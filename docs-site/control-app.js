import {
  SAVE_BAR_HOLD_MS,
  pageMarkup,
  saveBarView,
  savedRowKeys,
  toggleDisclosure,
} from './control-components.js?v=25';
import { problemPaths, problemsFromSnapshot } from './control-problems.js?v=2';
import { registerContentPages } from './control-content.js?v=25';
import { registerAnalyticsPage } from './control-analytics.js?v=27';
import { registerCommunityPages } from './control-community.js?v=24';
import { registerMappingPages } from './control-mappings.js?v=25';
import { registerUtilitiesPages } from './control-utilities.js?v=25';
import { controlIcon } from './control-icons.js?v=3';
import { GUILD_STORAGE_KEY, pickGuild } from './control-account.js?v=2';
import { createNavigationState, isNavigationBlocked } from './control-navigation.js?v=3';
import { installShell } from './control-shell.js?v=3';
import { controlRedirectFor, resolveControlRoute } from './control-router.js?v=3';
import { OVERVIEW_PATH, overviewPageMarkup } from './control-overview.js?v=2';
import { createActivityController, installActivityPage } from './control-secondary.js?v=24';
import { registerWorkflowPages, workflowPageMarkup } from './control-workflows.js?v=25';
import {
  controlState,
  hydrateControlPages,
  installControlStateGuards,
  installRegisteredControlPage,
  registeredControlPage,
  renderRegisteredControlContext,
  renderRegisteredControlPage,
} from './control-page-registry.js';
import {
  enqueueControlAction,
  enqueuePageSave,
  loadActivity,
  loadGuildState,
  waitForAction,
} from './control-api.js';

const ROUTE_KEY = 'rob-control-last-route';
const DOMAIN_ROUTE_KEY = 'rob-control-last-domain-routes';
const EXPANDED_KEY = 'rob-control-expanded-domain';
const BLOCKED_MS = 3000;
const SAVE_BAR_EXIT_MS = 180;

const shell = {
  main: document.querySelector('#controlMain'),
  wrap: document.querySelector('#controlMainWrap'),
  saveBar: document.querySelector('#controlSaveBar'),
};

let session = null;
let guild = null;
let guildState = null;
let snapshot = null;
let removePageInteractions = () => {};
let activityController = null;
let activityGuildId = null;
let shellController = null;
let blockedUntil = 0;
let blockedTimer = null;
let barExitTimer = null;
let lastBarKind = 'hidden';
let flagKey = '';
let pendingFocus = '';
const detailsOpen = new Set();
let serverStatus = { message: 'Server state has not loaded yet.', tone: 'neutral' };


registerCommunityPages();
registerContentPages();
registerUtilitiesPages();
registerAnalyticsPage();
registerWorkflowPages();
registerMappingPages();

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch { return fallback; }
}

const rememberedRoute = localStorage.getItem(ROUTE_KEY);
const lastByDomain = readJson(DOMAIN_ROUTE_KEY, {});
// A Control path that moved to another document redirects there before anything renders.
const clientRedirect = controlRedirectFor(location.pathname);
const resolvedInitial = resolveControlRoute(location.pathname, rememberedRoute, lastByDomain);
const navState = createNavigationState({
  currentPath: resolvedInitial.path,
  lastByDomain,
  expandedDomain: localStorage.getItem(EXPANDED_KEY),
});

function persistNavigation() {
  localStorage.setItem(ROUTE_KEY, navState.current.path);
  localStorage.setItem(DOMAIN_ROUTE_KEY, JSON.stringify(navState.lastByDomain));
}

function resetActivityController() {
  activityController = null;
  activityGuildId = null;
}

function ensureActivityController() {
  if (!session?.authenticated || !guild) return null;
  const guildId = String(guild.id);
  if (!activityController || activityGuildId !== guildId) {
    activityGuildId = guildId;
    activityController = createActivityController({
      guildId,
      actorId: session.user?.id || null,
      loadPage: (requestedGuildId, { cursor }) => loadActivity(requestedGuildId, { cursor }),
      onChange: () => {
        if (navState.current.path === '/control/activity') renderMain();
      },
    });
  }
  return activityController;
}

function currentContextMarkup() {
  return session?.authenticated
    ? renderRegisteredControlContext(navState.current.path, { snapshot: guildState })
    : '';
}

// Until each page owns its former context content, it renders at the end of the page in a closed disclosure.
function detailsMarkup(markup, open) {
  return `<div class="control-details" data-control-details data-open="${open}">
    <button type="button" class="control-disclose" data-details-toggle aria-expanded="${open}" aria-controls="controlDetailsBody">Details${controlIcon('chevron', { size: 12, className: 'control-disclose-chev' })}</button>
    <div class="control-reveal" id="controlDetailsBody"><div${open ? '' : ' inert'} data-details-body>${markup}</div></div>
  </div>`;
}

/* ---------- Save bar ---------- */

function activeBarState() {
  const pageKey = navState.current.path;
  if (!session?.authenticated || !registeredControlPage(pageKey)) return null;
  return controlState.get(pageKey);
}

function applyBarView(wrapper, view) {
  const status = wrapper.querySelector('[data-save-bar-status]');
  const text = wrapper.querySelector('[data-save-bar-status-text]');
  if (status) status.dataset.tone = ['failed', 'conflict', 'blocked'].includes(view.kind) ? 'bad' : 'neutral';
  status?.querySelectorAll('.control-spinner, .control-save-bar-check').forEach(node => node.remove());
  if (text) {
    text.textContent = view.message;
    if (view.spinner) text.insertAdjacentHTML('beforebegin', '<span class="control-spinner" aria-hidden="true"></span>');
    if (view.check) text.insertAdjacentHTML('beforebegin', `<span class="control-save-bar-check" aria-hidden="true">${controlIcon('check', { size: 16 })}</span>`);
  }
  const save = wrapper.querySelector('.control-button-primary');
  if (save && view.kind === 'failed') save.textContent = view.saveLabel;
  wrapper.querySelector('[data-save-bar-reload]')?.remove();
  if (view.showReload) {
    wrapper.insertAdjacentHTML('beforeend', '<button class="control-button control-button-secondary" type="button" data-save-bar-reload>Reload</button>');
  }
}

function syncSaveBar() {
  const host = shell.saveBar;
  if (!host) return;
  const state = activeBarState();
  const view = saveBarView(state, { blocked: Date.now() < blockedUntil });
  const staged = shell.main.querySelector('.control-save-bar');
  const docked = host.querySelector(':scope > .control-save-bar:not(.control-save-bar-saved)');

  if (view.visible) {
    clearTimeout(barExitTimer);
    if (staged) {
      staged.remove();
      applyBarView(staged, view);
      host.replaceChildren(staged);
    } else if (view.kind === 'saved') {
      host.innerHTML = `<div class="control-save-bar control-save-bar-saved"><span data-save-bar-status data-tone="neutral" class="control-save-bar-status"><span class="control-save-bar-check" aria-hidden="true">${controlIcon('check', { size: 16 })}</span><span data-save-bar-status-text>Saved</span></span></div>`;
    } else if (docked) {
      applyBarView(docked, view);
    }
    host.inert = false;
    host.dataset.bar = view.kind;
  } else {
    staged?.remove();
    host.inert = true;
    if (host.dataset.bar !== 'hidden') {
      host.dataset.bar = 'hidden';
      clearTimeout(barExitTimer);
      barExitTimer = setTimeout(() => { if (host.dataset.bar === 'hidden') host.replaceChildren(); }, SAVE_BAR_EXIT_MS);
    }
  }

  if (view.nudge) {
    host.classList.remove('nudge');
    void host.offsetWidth;
    host.classList.add('nudge');
  }
  if (view.kind !== lastBarKind && ['failed', 'conflict', 'blocked', 'saved'].includes(view.kind)) {
    shellController?.announce(view.message);
  }
  lastBarKind = view.kind;
}

shell.saveBar?.addEventListener('animationend', () => shell.saveBar.classList.remove('nudge'));

function flashBlocked() {
  blockedUntil = Date.now() + BLOCKED_MS;
  syncSaveBar();
  clearTimeout(blockedTimer);
  blockedTimer = setTimeout(() => {
    blockedUntil = 0;
    syncSaveBar();
  }, BLOCKED_MS);
}

/* ---------- Rendering ---------- */

function syncNavFlags() {
  if (!shellController) return;
  const paths = session?.authenticated && guildState ? problemPaths(problemsFromSnapshot(guildState)) : new Set();
  const key = [...paths].sort().join('|');
  if (key === flagKey) return;
  flagKey = key;
  shellController.setFlags(paths);
}

function renderMain({ entrance = false, savedRows = [] } = {}) {
  removePageInteractions();
  removePageInteractions = () => {};
  const pageKey = navState.current.path;
  const activity = pageKey === '/control/activity' && session?.authenticated && guild
    ? ensureActivityController()
    : null;
  const registeredMarkup = session?.authenticated
    ? renderRegisteredControlPage(pageKey, { snapshot: guildState })
    : null;
  const overviewMarkup = pageKey === OVERVIEW_PATH && session?.authenticated
    ? overviewPageMarkup({ snapshot: guildState })
    : null;
  const workflowMarkup = session?.authenticated ? workflowPageMarkup(pageKey) : '';
  const contextMarkup = currentContextMarkup();
  const scrollTop = shell.main.scrollTop;

  const pageHtml = registeredMarkup ?? overviewMarkup ?? (workflowMarkup || pageMarkup(navState.current, {
    authenticated: Boolean(session?.authenticated),
    state: guildState,
    snapshot,
    activityState: activity?.state || null,
  }));
  const details = contextMarkup.trim() ? detailsMarkup(contextMarkup, detailsOpen.has(pageKey)) : '';
  // Re-rendering after an edit must not steal focus or move the caret.
  const active = !entrance && shell.main.contains(document.activeElement) ? document.activeElement : null;
  const focusId = active?.id || '';
  const caret = focusId && typeof active.selectionStart === 'number' ? [active.selectionStart, active.selectionEnd] : null;
  shell.main.innerHTML = `<div class="control-page-frame${entrance ? ' control-page-enter' : ''}">${pageHtml}${details}</div>`;
  shell.main.dataset.pageKey = pageKey;
  shell.main.scrollTop = entrance ? 0 : scrollTop;
  for (const rowKey of savedRows) {
    shell.main.querySelectorAll(`[data-row-key="${CSS.escape(rowKey)}"]`).forEach(row => row.classList.add('control-row-saved'));
  }

  if (registeredMarkup !== null) {
    // Converted pages hold their resource rows in the page itself. Others keep them in Details.
    const contextRoot = shell.main.querySelector('[data-details-body]') || shell.wrap;
    removePageInteractions = installRegisteredControlPage(pageKey, shell.wrap, {
      snapshot: guildState,
      contextRoot,
      onSave: requestRegisteredPageSave,
      onApplySuggestions: requestMappingSuggestions,
      onAction: requestContentAction,
      onConfirm: message => window.confirm(message),
      rerender: renderMain,
    });
  } else if (activity) {
    removePageInteractions = installActivityPage(shell.main, activity);
  }
  const refocus = focusId ? shell.main.querySelector(`#${CSS.escape(focusId)}`) : null;
  if (refocus) {
    refocus.focus({ preventScroll: true });
    if (caret) { try { refocus.setSelectionRange(caret[0], caret[1]); } catch { /* number inputs have no selection API */ } }
  } else {
    shell.main.focus({ preventScroll: true });
  }
  // Overview fix buttons open a page with the broken control focused, once the entrance has rendered.
  if (entrance && pendingFocus) {
    const target = shell.main.querySelector(`#${CSS.escape(pendingFocus)}`);
    if (target) {
      target.focus();
      target.scrollIntoView?.({ block: 'center' });
    }
  }
  pendingFocus = '';
  syncSaveBar();
  syncNavFlags();
}

shell.main.addEventListener('click', event => {
  const overviewLink = event.target.closest?.('[data-overview-link]');
  if (overviewLink) {
    const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button;
    if (overviewLink.tagName === 'A' && modified) return;
    event.preventDefault();
    navigate(overviewLink.dataset.overviewLink, { focus: overviewLink.dataset.overviewFocus || '' });
    return;
  }
  const disclosureToggle = event.target.closest?.('[data-disclosure-toggle]');
  if (disclosureToggle) {
    toggleDisclosure(disclosureToggle);
    return;
  }
  const toggle = event.target.closest?.('[data-details-toggle]');
  if (!toggle) return;
  const container = toggle.closest('[data-control-details]');
  const open = container.dataset.open !== 'true';
  container.dataset.open = String(open);
  toggle.setAttribute('aria-expanded', String(open));
  container.querySelector('[data-details-body]').inert = !open;
  if (open) detailsOpen.add(navState.current.path);
  else detailsOpen.delete(navState.current.path);
});

function navigate(path, { replace = false, focus = '' } = {}) {
  const redirect = controlRedirectFor(path);
  if (redirect) {
    location.assign(redirect);
    return true;
  }
  const target = resolveControlRoute(path, navState.current.path, navState.lastByDomain).path;
  if (isNavigationBlocked(controlState, navState.current.path, target)) {
    flashBlocked();
    return false;
  }
  navState.select(target);
  persistNavigation();
  if (location.pathname !== navState.current.path) {
    history[replace ? 'replaceState' : 'pushState']({ control: true }, '', navState.current.path);
  }
  shellController?.setCurrent(navState.current.path);
  pendingFocus = focus;
  renderMain({ entrance: true });
  return true;
}

function setStatus(message, tone = '') {
  serverStatus = {
    message: message || '',
    tone: tone === 'good' || tone === 'bad' ? tone : 'neutral',
  };
  if (serverStatus.tone === 'bad' && serverStatus.message) shellController?.announce(serverStatus.message);
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

function mountIdentity(nextGuild = null) {
  const online = snapshot ? snapshot.fresh !== false : nextGuild?.online;
  shellController?.renderIdentity({
    session,
    guild: nextGuild && {
      ...nextGuild,
      snapshot_updated_at: snapshot?.updated_at ?? nextGuild.snapshot_updated_at,
      online,
    },
  });
}

async function signOut() {
  if (!session?.authenticated || !session.csrf_token) return;
  try {
    await request('/api/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Rob-CSRF': session.csrf_token,
      },
      body: '{}',
    });
  } catch (error) {
    setStatus(error.message, 'bad');
    return;
  }
  location.reload();
}

async function loadSession() {
  session = await request('/api/session');
  mountIdentity(null);
  if (!session.authenticated) {
    guild = null;
    guildState = null;
    snapshot = null;
    resetActivityController();
    setStatus('Sign in to load server state.');
    renderMain();
    return;
  }

  // The server menu lists every manageable guild; the remembered choice wins, then the first guild.
  guild = pickGuild(session, localStorage.getItem(GUILD_STORAGE_KEY));
  mountIdentity(guild);
  if (!guild) {
    resetActivityController();
    setStatus('No manageable Rob-bot server is available for this account.', 'bad');
    renderMain();
    return;
  }

  setStatus('Loading fresh server state…');
  try {
    const data = await loadGuildState(guild.id);
    guildState = data.state;
    snapshot = data.snapshot;
    hydrateControlPages(guildState, snapshot?.page_revisions || guildState?.meta?.page_revisions || {});
    setStatus(snapshot?.fresh ? 'Server state is current.' : 'Server state is unavailable.', snapshot?.fresh ? 'good' : 'bad');
    mountIdentity(guild);
  } catch (error) {
    guildState = null;
    snapshot = null;
    resetActivityController();
    setStatus(error?.message || 'Rob-bot could not provide fresh server state. Try again in a moment.', 'bad');
    renderMain();
    return;
  }
  renderMain({ entrance: true });
}

function announcePageState(pageKey) {
  document.dispatchEvent(new CustomEvent('rob-control-page-state', {
    detail: { pageKey, state: controlState.get(pageKey) },
  }));
}

async function requestRegisteredPageSave(pageKey, request) {
  if (!session?.authenticated || !guild) return;
  controlState.markSaving(pageKey, request);
  announcePageState(pageKey);
  renderMain();
  try {
    const queued = await enqueuePageSave({
      guildId: guild.id,
      csrfToken: session.csrf_token,
      request,
    });
    const action = await waitForAction(queued.action.id);
    if (action.status === 'failed' || action.status === 'rejected') {
      controlState.markSaveError(pageKey, action.error || 'The page could not be saved.');
      announcePageState(pageKey);
      renderMain();
      return;
    }

    const data = await loadGuildState(guild.id);
    guildState = data.state;
    snapshot = data.snapshot;
    const revision = snapshot?.page_revisions?.[pageKey]
      || guildState?.meta?.page_revisions?.[pageKey]
      || action.result?.revision
      || action.result?.current_revision
      || null;
    controlState.reconcile(pageKey, action.result || { outcome: 'saved' }, guildState, revision);
    announcePageState(pageKey);
    const saved = controlState.get(pageKey).status === 'saved';
    renderMain({ savedRows: saved ? savedRowKeys(request.changes) : [] });
    if (saved) {
      // Hold the saved bar for 900ms, let it exit, then clear the page's saved message.
      setTimeout(() => {
        controlState.settleSaved(pageKey);
        announcePageState(pageKey);
        if (navState.current.path !== pageKey) return;
        syncSaveBar();
        setTimeout(() => { if (navState.current.path === pageKey) renderMain(); }, SAVE_BAR_EXIT_MS);
      }, SAVE_BAR_HOLD_MS);
    }
  } catch (error) {
    controlState.markSaveError(pageKey, error.message);
    announcePageState(pageKey);
    renderMain();
  }
}

async function requestMappingSuggestions(payload) {
  if (!session?.authenticated || !guild) {
    throw new Error('Sign in and select a server before applying reviewed mappings.');
  }

  const queued = await enqueueControlAction({
    guildId: guild.id,
    csrfToken: session.csrf_token,
    actionType: 'apply_mapping_suggestions',
    payload,
  });
  const action = await waitForAction(queued.action.id);
  if (action.status === 'failed' || action.status === 'rejected') {
    throw new Error(action.error || 'The reviewed mappings could not be applied.');
  }

  const data = await loadGuildState(guild.id);
  guildState = data.state;
  snapshot = data.snapshot;
  hydrateControlPages(
    guildState,
    snapshot?.page_revisions || guildState?.meta?.page_revisions || {},
  );
  return { snapshot };
}

async function requestContentAction(action) {
  if (!session?.authenticated || !guild) {
    throw new Error('Sign in and select a server before publishing content.');
  }
  const queued = await enqueueControlAction({
    guildId: guild.id,
    csrfToken: session.csrf_token,
    actionType: action.actionType,
    payload: action.payload,
  });
  const completed = await waitForAction(queued.action.id);
  if (completed.status === 'failed' || completed.status === 'rejected') {
    throw new Error(completed.error || 'The content action could not be completed.');
  }

  const data = await loadGuildState(guild.id);
  guildState = data.state;
  snapshot = data.snapshot;
  hydrateControlPages(
    guildState,
    snapshot?.page_revisions || guildState?.meta?.page_revisions || {},
  );
  return completed.result || {};
}

window.addEventListener('popstate', () => {
  const redirect = controlRedirectFor(location.pathname);
  if (redirect) {
    location.replace(redirect);
    return;
  }
  const destination = resolveControlRoute(location.pathname, navState.current.path, navState.lastByDomain);
  if (isNavigationBlocked(controlState, navState.current.path, destination.path)) {
    // Undo the browser's history step and keep the current page.
    history.pushState({ control: true }, '', navState.current.path);
    flashBlocked();
    return;
  }
  navState.select(destination.path);
  persistNavigation();
  shellController?.setCurrent(navState.current.path);
  renderMain({ entrance: true });
  shellController?.closeDrawer({ restoreFocus: false });
});

shell.wrap?.addEventListener('click', async event => {
  if (!event.target.closest?.('[data-save-bar-reload]')) return;
  const pageKey = navState.current.path;
  if (!session?.authenticated || !guild) return;
  try {
    const data = await loadGuildState(guild.id);
    guildState = data.state;
    snapshot = data.snapshot;
    hydrateControlPages(guildState, snapshot?.page_revisions || guildState?.meta?.page_revisions || {});
    const state = controlState.get(pageKey);
    // The draft stays; it now sits on the latest revision so the user can review and save again.
    if (state.status === 'conflict') state.status = state.dirty ? 'dirty' : 'clean';
    renderMain();
  } catch (error) {
    setStatus(error?.message || 'Rob-bot could not reload server state.', 'bad');
  }
});

shellController = installShell({
  currentPath: navState.current.path,
  onNavigate: path => navigate(path),
  onSignOut: () => signOut(),
  getLastByDomain: () => navState.lastByDomain,
  onSelectGuild: () => {
    if (controlState.hasDirty()) {
      flashBlocked();
      return;
    }
    loadSession().catch(error => {
      setStatus(error.message, 'bad');
      renderMain();
    });
  },
});
installControlStateGuards({
  getCurrentPageKey: () => navState.current.path,
  onSave: requestRegisteredPageSave,
});

if (clientRedirect) {
  location.replace(clientRedirect);
} else {
  if (location.pathname !== resolvedInitial.path) history.replaceState({ control: true }, '', resolvedInitial.path);
  loadSession().catch(error => {
    setStatus(error.message, 'bad');
    renderMain();
  });
}
