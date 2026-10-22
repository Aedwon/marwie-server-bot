import { installDrawerController } from './control-navigation.js';

export function installContextDrawerController(options = {}) {
  return installDrawerController(options);
}

function triggerScope(pageRoot) {
  if (pageRoot?.ownerDocument) return pageRoot.ownerDocument;
  if (pageRoot?.querySelectorAll) return pageRoot;
  return typeof document === 'undefined' ? null : document;
}

export function syncContextTriggers({ shell, trigger, triggers = [], pageRoot = null } = {}) {
  if (!shell) return;
  const hasContext = shell.dataset.context === 'true';
  const navMode = shell.dataset.navMode || 'expanded';
  const contextMode = shell.dataset.contextMode || 'none';
  const scope = triggerScope(pageRoot);
  const items = [...new Set([
    trigger,
    ...triggers,
    ...(scope?.querySelectorAll?.('[data-control-context-open]') || []),
  ].filter(Boolean))];

  items.forEach(item => {
    const placement = item.dataset?.contextTrigger || 'page';
    const visible = hasContext
      && contextMode === 'drawer'
      && (placement === 'topbar' ? navMode === 'drawer' : navMode !== 'drawer');
    item.hidden = !visible;
    if (!visible) item.setAttribute('aria-expanded', 'false');
  });
}

export function syncContextAvailability({ drawer, trigger, triggers = [], root, markup = '' } = {}) {
  if (!drawer || !root) return false;
  const hasContext = Boolean(String(markup || '').trim());
  const shell = root.closest?.('.control-shell');
  if (shell) shell.dataset.context = String(hasContext);
  root.innerHTML = hasContext ? markup : '';
  drawer.hidden = !hasContext;

  const allTriggers = [...new Set([trigger, ...triggers].filter(Boolean))];
  if (!hasContext) {
    drawer.dataset.open = 'false';
    drawer.setAttribute('aria-hidden', 'true');
    drawer.inert = true;
    allTriggers.forEach(item => {
      item.hidden = true;
      item.setAttribute('aria-expanded', 'false');
    });
    return false;
  }

  if (shell?.dataset.contextMode === 'column') {
    drawer.dataset.open = 'true';
    drawer.removeAttribute('aria-hidden');
    drawer.inert = false;
  } else {
    drawer.dataset.open = 'false';
    drawer.setAttribute('aria-hidden', 'true');
    drawer.inert = true;
  }

  syncContextTriggers({ shell, trigger, triggers, pageRoot: root });
  return true;
}
