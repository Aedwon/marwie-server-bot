import { identityMarkup, navigationMarkup, pageMarkup } from './control-components.js';
import { installAccountMenu } from './control-account.js';
import { mountControlDestination } from './control-page-adapter.js';
import { registerMappingPages } from './control-mappings.js';
import { registerUtilitiesPages } from './control-utilities.js';
import { installThemeControls } from './control-theme.js';
import { createNavigationState, installDrawerController, navigationModel } from './control-navigation.js';
import { resolveControlRoute } from './control-router.js';
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
  legacy: document.querySelector('#controlLegacyHost'),
};

let session = null;
let guild = null;
let guildState = null;
let snapshot = null;
let removeAccountMenu = () => {};
let removePageInteractions = () => {};

function installMappingStyles() {
  if (document.querySelector('link[data-control-mappings-styles]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/control-mappings.css?v=1';
  link.dataset.controlMappingsStyles = 'true';
  document.head.append(link);
}

function installUtilitiesStyles() {
  if (document.querySelector('link[data-control-utilities-styles]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/control-utilities.css?v=1';
  link.dataset.controlUtilitiesStyles = 'true';
  document.head.append(link);
}

installMappingStyles();
installUtilitiesStyles();
registerMappingPages();
registerUtilitiesPages();

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

function renderMain() {
  removePageInteractions();
  removePageInteractions = () => {};

  const pageKey = navState.current.path;
  const registeredMarkup = session?.authenticated
    ? renderRegisteredControlPage(pageKey, { snapshot: guildState })
    : null;

  mountControlDestination({
    main: shell.main,
    destination: navState.current,
    legacyRoot: shell.legacy,
    allowLegacy: Boolean(session?.authenticated),
    renderFallback: destination => registeredMarkup ?? pageMarkup(destination, {
      authenticated: Boolean(session?.authenticated),
      state: guildState,
      snapshot,
    }),
  });

  if (registeredMarkup !== null) {
    removePageInteractions = installRegisteredControlPage(pageKey, shell.main, {
      snapshot: guildState,
      onSave: requestRegisteredPageSave,
      onApplySuggestions: requestMappingSuggestions,
      rerender: renderMain,
    });
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
    setStatus('Sign in to load server state.');
    renderMain();
    return;
  }

  // Product IA intentionally has no server selector. Control uses the first
  // installed/manageable Rob-bot guild returned by the authenticated session.
  guild = session.guilds?.[0] || null;
  mountIdentity(identityMarkup(session, guild));
  if (!guild) {
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
