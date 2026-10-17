import { installDrawerController } from './control-navigation.js';

export function installContextDrawerController(options = {}) {
  return installDrawerController(options);
}

export function syncContextAvailability({ drawer, trigger, root, markup = '', mediaQuery } = {}) {
  if (!drawer || !trigger || !root || !mediaQuery) return false;
  const hasContext = Boolean(String(markup || '').trim());
  root.innerHTML = hasContext ? markup : '';
  drawer.hidden = !hasContext;
  trigger.hidden = !hasContext || !mediaQuery.matches;

  if (!hasContext) {
    drawer.dataset.open = 'false';
    drawer.setAttribute('aria-hidden', 'true');
    drawer.inert = true;
    trigger.setAttribute('aria-expanded', 'false');
    return false;
  }

  if (mediaQuery.matches) {
    drawer.dataset.open = 'false';
    drawer.setAttribute('aria-hidden', 'true');
    drawer.inert = true;
    trigger.setAttribute('aria-expanded', 'false');
  } else {
    drawer.dataset.open = 'true';
    drawer.removeAttribute('aria-hidden');
    drawer.inert = false;
    trigger.setAttribute('aria-expanded', 'false');
  }
  return true;
}
