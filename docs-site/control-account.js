// Popovers for the sidebar (account and server menus) and the identity helpers they share.

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
const GUILD_KEY = 'rob-control-guild-id';

export const GUILD_STORAGE_KEY = GUILD_KEY;

export function syncedLabel(updatedAt, now = Date.now()) {
  const time = new Date(updatedAt).getTime();
  if (!updatedAt || !Number.isFinite(time)) return '';
  const minutes = Math.max(0, Math.floor((now - time) / 60000));
  if (minutes < 1) return 'Synced just now';
  if (minutes < 60) return `Synced ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Synced ${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `Synced ${days} day${days === 1 ? '' : 's'} ago`;
}

export function accountRoleLine(guild) {
  if (!guild) return '';
  return `${guild.administrator ? 'Administrator' : 'Manager'} in ${guild.name}`;
}

export function pickGuild(session, storedId = null) {
  const guilds = session?.guilds || [];
  return guilds.find(guild => String(guild.id) === String(storedId)) || guilds[0] || null;
}

export function installPopover({
  trigger,
  menu,
  align = 'right',
  doc = globalThis.document,
  onOpen = () => {},
  onClose = () => {},
} = {}) {
  if (!trigger || !menu) return { open() {}, close() {}, isOpen: () => false, destroy() {} };
  let opened = false;

  const items = () => [...(menu.querySelectorAll?.(FOCUSABLE) || [])].filter(item => !item.hidden);

  const place = () => {
    const rect = trigger.getBoundingClientRect?.();
    if (!rect) return;
    if (align === 'up') {
      // Anchored above a trigger at the bottom of the sidebar; opens upward, left edges aligned.
      menu.style.top = 'auto';
      menu.style.bottom = `${Math.round((globalThis.innerHeight || 0) - rect.top + 6)}px`;
      menu.style.right = 'auto';
      menu.style.left = `${Math.round(rect.left)}px`;
      return;
    }
    menu.style.bottom = 'auto';
    menu.style.top = `${Math.round(rect.bottom + 6)}px`;
    if (align === 'right') {
      menu.style.left = 'auto';
      menu.style.right = `${Math.round((globalThis.innerWidth || 0) - rect.right)}px`;
    } else {
      menu.style.right = 'auto';
      menu.style.left = `${Math.round(rect.left)}px`;
    }
  };

  const close = ({ restoreFocus = false } = {}) => {
    if (!opened) return;
    opened = false;
    menu.dataset.open = 'false';
    menu.inert = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus?.();
    onClose();
  };

  const open = () => {
    if (opened) return;
    opened = true;
    place();
    menu.inert = false;
    menu.dataset.open = 'true';
    trigger.setAttribute('aria-expanded', 'true');
    onOpen();
    items()[0]?.focus?.();
  };

  const onTrigger = event => {
    event.preventDefault?.();
    if (opened) close({ restoreFocus: true });
    else open();
  };
  const onOutside = event => {
    if (!opened) return;
    if (menu.contains?.(event.target) || trigger.contains?.(event.target)) return;
    close();
  };
  const onKeyDown = event => {
    if (!opened) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close({ restoreFocus: true });
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) || !menu.contains?.(event.target)) return;
    const list = items();
    if (!list.length) return;
    event.preventDefault();
    const at = list.indexOf(event.target);
    let next = at;
    if (event.key === 'ArrowDown') next = (at + 1) % list.length;
    else if (event.key === 'ArrowUp') next = (at - 1 + list.length) % list.length;
    else if (event.key === 'Home') next = 0;
    else next = list.length - 1;
    list[next].focus?.();
  };

  menu.inert = true;
  menu.dataset.open = 'false';
  trigger.addEventListener('click', onTrigger);
  doc?.addEventListener?.('click', onOutside);
  doc?.addEventListener?.('keydown', onKeyDown);

  return {
    open,
    close,
    isOpen: () => opened,
    destroy() {
      trigger.removeEventListener('click', onTrigger);
      doc?.removeEventListener?.('click', onOutside);
      doc?.removeEventListener?.('keydown', onKeyDown);
    },
  };
}

// Account menu: a popover plus the Sign out action.
export function installAccountMenu({ trigger, menu, signOut, onSignOut, doc, onOpen } = {}) {
  const popover = installPopover({ trigger, menu, align: 'up', doc, onOpen });
  const onClick = async event => {
    event.preventDefault?.();
    if (typeof onSignOut !== 'function') return;
    signOut.disabled = true;
    try {
      await onSignOut();
    } finally {
      signOut.disabled = false;
    }
  };
  signOut?.addEventListener?.('click', onClick);
  return {
    ...popover,
    destroy() {
      popover.destroy();
      signOut?.removeEventListener?.('click', onClick);
    },
  };
}
