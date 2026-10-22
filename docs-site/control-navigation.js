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
      icon: group.icon,
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

export function installDrawerController({
  drawer,
  trigger,
  triggers = [],
  closeButton,
  isDrawer = () => true,
  isAvailable = () => true,
  delegateRoot = null,
  delegateSelector = '',
  onOpen = () => {},
  onClose = () => {},
} = {}) {
  const staticTriggers = [...new Set([trigger, ...triggers].filter(Boolean))];
  const delegated = Boolean(delegateRoot && delegateSelector);
  if (!drawer || (!staticTriggers.length && !delegated)) {
    return { open: () => {}, close: () => {}, sync: () => {}, destroy: () => {} };
  }
  let opener = null;
  let openedAsDrawer = false;

  const triggerItems = () => {
    const dynamic = delegated
      ? [...(delegateRoot.querySelectorAll?.(delegateSelector) || [])]
      : [];
    return [...new Set([...staticTriggers, ...dynamic].filter(Boolean))];
  };
  const isModal = () => Boolean(isAvailable() && isDrawer());
  const setExpanded = value => triggerItems().forEach(item => item.setAttribute('aria-expanded', String(value)));

  const close = ({ restoreFocus = true } = {}) => {
    const wasOpen = openedAsDrawer;
    if (!wasOpen) return;
    openedAsDrawer = false;
    drawer.dataset.open = 'false';
    setExpanded(false);
    if (isModal()) {
      drawer.setAttribute('aria-hidden', 'true');
      drawer.inert = true;
    } else {
      drawer.removeAttribute('aria-hidden');
      drawer.inert = !isAvailable();
    }
    if (restoreFocus && wasOpen) opener?.focus?.();
    opener = null;
    if (wasOpen) onClose();
  };

  const open = () => {
    if (!isModal() || openedAsDrawer) return;
    openedAsDrawer = true;
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : triggerItems()[0];
    drawer.inert = false;
    drawer.removeAttribute('aria-hidden');
    drawer.dataset.open = 'true';
    setExpanded(true);
    focusableWithin(drawer)[0]?.focus();
    onOpen();
  };

  const sync = () => {
    if (!isAvailable()) {
      openedAsDrawer = false;
      drawer.dataset.open = 'false';
      setExpanded(false);
      drawer.setAttribute('aria-hidden', 'true');
      drawer.inert = true;
      return;
    }
    if (isDrawer()) {
      if (openedAsDrawer) {
        drawer.inert = false;
        drawer.removeAttribute('aria-hidden');
        drawer.dataset.open = 'true';
        setExpanded(true);
      } else {
        drawer.dataset.open = 'false';
        setExpanded(false);
        drawer.setAttribute('aria-hidden', 'true');
        drawer.inert = true;
      }
      return;
    }
    openedAsDrawer = false;
    drawer.inert = false;
    drawer.removeAttribute('aria-hidden');
    drawer.dataset.open = 'true';
    setExpanded(false);
  };

  const onKeyDown = event => {
    if (!isModal() || drawer.dataset.open !== 'true') return;
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

  const onTrigger = event => {
    if (delegated) {
      const target = event?.target?.closest?.(delegateSelector);
      if (!target || !delegateRoot.contains?.(target)) return;
    }
    if (drawer.dataset.open === 'true') close();
    else open();
  };
  const onCloseClick = () => close();
  if (delegated) delegateRoot.addEventListener('click', onTrigger);
  else staticTriggers.forEach(item => item.addEventListener('click', onTrigger));
  closeButton?.addEventListener('click', onCloseClick);
  drawer.addEventListener('keydown', onKeyDown);
  sync();

  return {
    open,
    close,
    sync,
    destroy: () => {
      if (delegated) delegateRoot.removeEventListener('click', onTrigger);
      else staticTriggers.forEach(item => item.removeEventListener('click', onTrigger));
      closeButton?.removeEventListener('click', onCloseClick);
      drawer.removeEventListener('keydown', onKeyDown);
    },
  };
}
