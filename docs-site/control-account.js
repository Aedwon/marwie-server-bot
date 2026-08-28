export function installAccountMenu(root, { onSignOut } = {}) {
  const trigger = root?.querySelector?.('[data-account-trigger]');
  const menu = root?.querySelector?.('[data-account-menu]');
  const signOut = root?.querySelector?.('[data-account-sign-out]');

  if (!trigger || !menu) return () => {};

  const doc = root.ownerDocument || globalThis.document;

  const close = ({ restoreFocus = false } = {}) => {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus?.();
  };

  const open = () => {
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
  };

  const toggle = event => {
    event.preventDefault();
    if (menu.hidden) open();
    else close();
  };

  const outside = event => {
    if (!root.contains?.(event.target)) close();
  };

  const keydown = event => {
    if (event.key !== 'Escape' || menu.hidden) return;
    event.preventDefault();
    close({ restoreFocus: true });
  };

  const signOutClick = async event => {
    event.preventDefault();
    if (typeof onSignOut !== 'function') return;
    signOut.disabled = true;
    try {
      await onSignOut();
    } finally {
      signOut.disabled = false;
    }
  };

  trigger.addEventListener('click', toggle);
  doc?.addEventListener?.('click', outside);
  doc?.addEventListener?.('keydown', keydown);
  signOut?.addEventListener?.('click', signOutClick);

  return () => {
    trigger.removeEventListener('click', toggle);
    doc?.removeEventListener?.('click', outside);
    doc?.removeEventListener?.('keydown', keydown);
    signOut?.removeEventListener?.('click', signOutClick);
  };
}
