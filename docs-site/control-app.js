import { identityMarkup, navigationMarkup, pageMarkup } from './control-components.js';
import { installAccountMenu } from './control-account.js';
import { registerContentPages } from './control-content.js';
import { registerAnalyticsPage } from './control-analytics.js';
import { registerCommunityPages } from './control-community.js';
import { registerMappingPages } from './control-mappings.js';
import { registerUtilitiesPages } from './control-utilities.js';
import { installThemeControls } from './control-theme.js';
import { createNavigationState, installDrawerController, navigationModel } from './control-navigation.js';
import { resolveControlRoute } from './control-router.js';
import { createActivityController, installActivityPage } from './control-secondary.js';
import { workflowPageMarkup } from './control-workflows.js';
import {
  controlState,
  hydrateControlPages,
  installControlStateGuards,
  installRegisteredControlPage,
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
const NARROW_QUERY = '(max-width: 944px)';

const shell = {
  nav: document.querySelector('#controlNavContent'),
  drawer: document.querySelector('#controlNavDrawer'),
  menu: document.querySelector('#controlMenuButton'),
  close: document.querySelector('#controlNavClose'),
  main: document.querySelector('#controlMain'),
  identity: document.querySelector('#controlIdentity'),
  status: document.querySelector('#controlGlobalStatus'),
};

let session = null;
let guild = null;
let guildState = null;
let snapshot = null;
let removeAccountMenu = () => {};
let removePageInteractions = () => {};
let activityController = null;
let activityGuildId = null;

function installDomainStyles({ marker, href }) {
  if (document.querySelector(`link[${marker}]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.setAttribute(marker, 'true');
  document.head.append(link);
}

installDomainStyles({ marker: 'data-control-community-styles', href: '/control-community.css?v=1' });
installDomainStyles({ marker: 'data-control-content-styles', href: '/control-content.css?v=1' });
installDomainStyles({ marker: 'data-control-utilities-styles', href: '/control-utilities.css?v=1' });
installDomainStyles({ marker: 'data-control-analytics-workflows-styles', href: '/control-analytics-workflows.css?v=1' });
installDomainStyles({ marker: 'data-control-mappings-styles', href: '/control-mappings.css?v=1' });
installDomainStyles({ marker: 'data-control-secondary-styles', href: '/control-secondary.css?v=1' });
registerCommunityPages();
registerContentPages();
registerUtilitiesPages();
registerAnalyticsPage();
registerMappingPages();

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch { return fallback; }
}

const rememberedRoute = localStorage.getItem(ROUTE_KEY);
const lastByDomain = readJson(DOMAIN_ROUTE_KEY, {});
const resolvedInitial = resolveControlRoute(location.pathname, rememberedRoute, lastByDomain);
const navState = createNavigationState({
  currentPath: resolvedInitial.path,
  lastByDomain,
  expandedDomain: localStorage.getItem(EXPANDED_KEY),
});

function persistNavigation() {
  localStorage.setItem(ROUTE_KEY, navState.current.path);
  localStorage.setItem(DOMAIN_ROUTE_KEY, JSON.stringify(navState.lastByDomain));
  localStorage.setItem(EXPANDED_KEY, navState.expandedDomain);
}

function renderNavigation() {
  shell.nav.innerHTML = navigationMarkup(navigationModel(navState.current, navState.expandedDomain));
  shell.nav.querySelectorAll('a[href^="/control/"]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      navigate(link.getAttribute('href'));
    });
  });
  shell.nav.querySelectorAll('[data-domain-select]').forEach(button => {
    button.addEventListener('click', () => {
      const destination = navState.selectDomain(button.dataset.domainSelect);
      navigate(destination.path);
    });
  });
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

function renderMain() {
  removePageInteractions();
  removePageInteractions = () => {};

  const pageKey = navState.current.path;
  const activity = pageKey === '/control/activity' && session?.authenticated && guild
    ? ensureActivityController()
    : null;
  const registeredMarkup = session?.authenticated
    ? renderRegisteredControlPage(pageKey, { snapshot: guildState })
    : null;
  const workflowMarkup = session?.authenticated ? workflowPageMarkup(pageKey) : '';

  shell.main.replaceChildren?.();
  shell.main.innerHTML = registeredMarkup ?? (workflowMarkup || pageMarkup(navState.current, {
    authenticated: Boolean(session?.authenticated),
    state: guildState,
    snapshot,
    activityState: activity?.state || null,
  }));
  shell.main.dataset.pageKey = pageKey;

  if (registeredMarkup !== null) {
    removePageInteractions = installRegisteredControlPage(pageKey, shell.main, {
      snapshot: guildState,
      onSave: requestRegisteredPageSave,
      onApplySuggestions: requestMappingSuggestions,
      onAction: requestContentAction,
      onConfirm: message => window.confirm(message),
      rerender: renderMain,
    });
  } else if (activity) {
    removePageInteractions = installActivityPage(shell.main, activity);
  }
  shell.main.focus({ preventScroll: true });
}

function navigate(path, { replace = false } = {}) {
  navState.select(resolveControlRoute(path, navState.current.path, navState.lastByDomain).path);
  persistNavigation();
  if (location.pathname !== navState.current.path) {
    history[replace ? 'replaceState' : 'pushState']({ control: true }, '', navState.current.path);
  }
  renderNavigation();
  renderMain();
  if (matchMedia(NARROW_QUERY).matches) shell.close.click();
}

function setStatus(message, tone = '') {
  shell.status.textContent = message || '';
  shell.status.dataset.tone = tone;
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

function mountIdentity(markup) {
  removeAccountMenu();
  shell.identity.innerHTML = markup;
  removeAccountMenu = installAccountMenu(shell.identity, {
    onSignOut: signOut,
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
  mountIdentity(identityMarkup(session, null));
  if (!session.authenticated) {
    guild = null;
    guildState = null;
    snapshot = null;
    resetActivityController();
    setStatus('Sign in to load server state.');
    renderMain();
    return;
  }

  // Product IA intentionally has no server selector. Control uses the first
  // installed/manageable Rob-bot guild returned by the authenticated session.
  guild = session.guilds?.[0] || null;
  mountIdentity(identityMarkup(session, guild));
  if (!guild) {
    resetActivityController();
    setStatus('No manageable Rob-bot server is available for this account.', 'bad');
    renderMain();
    return;
  }

  setStatus('Loading fresh server state…');
  const data = await loadGuildState(guild.id);
  guildState = data.state;
  snapshot = data.snapshot;
  hydrateControlPages(guildState, snapshot?.page_revisions || guildState?.meta?.page_revisions || {});
  setStatus(snapshot?.fresh ? 'Server state is current.' : 'Server state is unavailable.', snapshot?.fresh ? 'good' : 'bad');
  renderMain();
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
    renderMain();
    if (controlState.get(pageKey).status === 'saved') {
      setTimeout(() => {
        controlState.settleSaved(pageKey);
        announcePageState(pageKey);
        if (navState.current.path === pageKey) renderMain();
      }, 2500);
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
  const destination = resolveControlRoute(location.pathname, navState.current.path, navState.lastByDomain);
  navState.select(destination.path);
  persistNavigation();
  renderNavigation();
  renderMain();
});

installDrawerController({
  drawer: shell.drawer,
  trigger: shell.menu,
  closeButton: shell.close,
  mediaQuery: matchMedia(NARROW_QUERY),
});
installThemeControls({
  root: document.documentElement,
  buttons: [...document.querySelectorAll('[data-theme-choice]')],
  media: matchMedia('(prefers-color-scheme: dark)'),
  storage: localStorage,
  themeColor: document.querySelector('meta[name="theme-color"]'),
});
installControlStateGuards({
  getCurrentPageKey: () => navState.current.path,
  onSave: requestRegisteredPageSave,
});
renderNavigation();

if (location.pathname !== resolvedInitial.path) history.replaceState({ control: true }, '', resolvedInitial.path);

loadSession().catch(error => {
  setStatus(error.message, 'bad');
  renderMain();
});
