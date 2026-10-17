import {
  CONTROL_NAV_GROUPS,
  CONTROL_PLAYBOOKS,
  destinationForDomain,
  destinationForPath,
  navGroupForPath,
} from './control-router.js';

const NAV_GROUP_KEYS = new Set(CONTROL_NAV_GROUPS.map(item => item.key));
const DEFAULT_GROUP = 'engagement';

export function createNavigationState({ currentPath, lastByDomain = {}, expandedDomain = null } = {}) {
  let current = destinationForPath(currentPath) || destinationForDomain('community', lastByDomain);
  const memory = { ...lastByDomain };
  if (current?.domain) memory[current.domain] = current.path;
  let expanded = navGroupForPath(current?.path)?.key
    || (NAV_GROUP_KEYS.has(expandedDomain) ? expandedDomain : DEFAULT_GROUP);

  return {
    get current() { return current; },
    get expandedDomain() { return expanded; },
    get lastByDomain() { return { ...memory }; },
    revealDomain(groupKey) {
      if (!NAV_GROUP_KEYS.has(groupKey)) return current;
      expanded = groupKey;
      return current;
    },
    select(path) {
      const next = destinationForPath(path);
      if (!next) return current;
      current = next;
      if (next.domain) memory[next.domain] = next.path;
      expanded = navGroupForPath(next.path)?.key || expanded;
      return current;
    },
  };
}

function targetForItem(item, lastByDomain) {
  if (item.key !== 'resources') return item.path;
  const remembered = destinationForPath(lastByDomain?.mappings);
  return remembered?.domain === 'mappings' ? remembered.path : item.path;
}

export function navigationModel(current, expandedDomain = DEFAULT_GROUP, lastByDomain = {}) {
  const expanded = NAV_GROUP_KEYS.has(expandedDomain) ? expandedDomain : (navGroupForPath(current?.path)?.key || DEFAULT_GROUP);
  return {
    primary: CONTROL_NAV_GROUPS.map(group => ({
      key: group.key,
      label: group.label,
      expanded: group.key === expanded,
      current: group.items.some(item => (item.matchPaths || [item.path]).includes(current?.path)),
      children: group.items.map(item => {
        const targetPath = targetForItem(item, lastByDomain);
        const currentItem = (item.matchPaths || [item.path]).includes(current?.path);
        return { ...item, path: targetPath, current: currentItem };
      }),
    })),
    secondary: CONTROL_PLAYBOOKS.map(item => ({ ...item, current: current?.path === item.path })),
  };
}

function focusableWithin(node) {
  return [...node.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter(item => !item.hidden && item.getAttribute('aria-hidden') !== 'true');
}

export function installDrawerController({ drawer, trigger, closeButton, mediaQuery }) {
  if (!drawer || !trigger || !mediaQuery) return () => {};
  let opener = null;

  const close = ({ restoreFocus = true } = {}) => {
    drawer.dataset.open = 'false';
    trigger.setAttribute('aria-expanded', 'false');
    if (mediaQuery.matches) {
      drawer.setAttribute('aria-hidden', 'true');
      drawer.inert = true;
    }
    if (restoreFocus) opener?.focus?.();
    opener = null;
  };

  const open = () => {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : trigger;
    drawer.inert = false;
    drawer.removeAttribute('aria-hidden');
    drawer.dataset.open = 'true';
    trigger.setAttribute('aria-expanded', 'true');
    focusableWithin(drawer)[0]?.focus();
  };

  const syncMode = () => {
    if (mediaQuery.matches) close({ restoreFocus: false });
    else {
      drawer.inert = false;
      drawer.removeAttribute('aria-hidden');
      drawer.dataset.open = 'true';
      trigger.setAttribute('aria-expanded', 'false');
    }
  };

  const onKeyDown = event => {
    if (!mediaQuery.matches || drawer.dataset.open !== 'true') return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusableWithin(drawer);
    if (!items.length) return;
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const onTrigger = () => drawer.dataset.open === 'true' ? close() : open();
  const onClose = () => close();
  trigger.addEventListener('click', onTrigger);
  closeButton?.addEventListener('click', onClose);
  drawer.addEventListener('keydown', onKeyDown);
  mediaQuery.addEventListener('change', syncMode);
  syncMode();

  return () => {
    trigger.removeEventListener('click', onTrigger);
    closeButton?.removeEventListener('click', onClose);
    drawer.removeEventListener('keydown', onKeyDown);
    mediaQuery.removeEventListener('change', syncMode);
  };
}
