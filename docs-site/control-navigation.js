import {
  CONTROL_DOMAINS,
  SECONDARY_DESTINATIONS,
  destinationForDomain,
  destinationForPath,
} from './control-router.js';

const EXPANDABLE_DOMAINS = new Set(CONTROL_DOMAINS.filter(item => !item.direct).map(item => item.key));

export function createNavigationState({ currentPath, lastByDomain = {}, expandedDomain = null } = {}) {
  let current = destinationForPath(currentPath) || destinationForDomain('community', lastByDomain);
  const memory = { ...lastByDomain };
  if (current?.domain && EXPANDABLE_DOMAINS.has(current.domain)) memory[current.domain] = current.path;
  let expanded = EXPANDABLE_DOMAINS.has(current?.domain)
    ? current.domain
    : EXPANDABLE_DOMAINS.has(expandedDomain)
      ? expandedDomain
      : 'community';

  return {
    get current() { return current; },
    get expandedDomain() { return expanded; },
    get lastByDomain() { return { ...memory }; },
    select(path) {
      const next = destinationForPath(path);
      if (!next) return current;
      current = next;
      if (next.domain && EXPANDABLE_DOMAINS.has(next.domain)) {
        expanded = next.domain;
        memory[next.domain] = next.path;
      }
      return current;
    },
    selectDomain(domainKey) {
      const next = destinationForDomain(domainKey, memory);
      if (!next) return current;
      if (EXPANDABLE_DOMAINS.has(domainKey)) expanded = domainKey;
      return this.select(next.path);
    },
  };
}

export function navigationModel(current, expandedDomain = 'community') {
  const expanded = EXPANDABLE_DOMAINS.has(expandedDomain) ? expandedDomain : 'community';
  return {
    primary: CONTROL_DOMAINS.map(domain => ({
      key: domain.key,
      label: domain.label,
      path: domain.path,
      direct: domain.direct,
      expanded: !domain.direct && domain.key === expanded,
      current: current?.domain === domain.key,
      children: domain.children.map(child => ({ ...child, current: current?.path === child.path })),
    })),
    secondary: SECONDARY_DESTINATIONS.map(item => ({ ...item, current: current?.path === item.path })),
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
