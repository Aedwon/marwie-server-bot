export const NAV_PREFERENCE_KEY = 'rob-control-nav-preference';

export const SHELL_METRICS = Object.freeze({
  edge: 12,
  gap: 12,
  rail: 60,
  labeled: 232,
  centerMin: 600,
  drawerBelow: 760,
});

const NAV_PREFERENCES = new Set(['auto', 'expanded', 'collapsed']);

function normalizedPreference(value) {
  return NAV_PREFERENCES.has(value) ? value : 'auto';
}

export function shellThresholds() {
  const { edge, gap, labeled, centerMin, drawerBelow } = SHELL_METRICS;
  return {
    navDrawer: drawerBelow,
    labelsFit: labeled + centerMin + gap + (2 * edge),
  };
}

export function resolveShellLayout({ width = 0, navPreference = 'auto' } = {}) {
  const thresholds = shellThresholds();
  const preference = normalizedPreference(navPreference);
  const safeWidth = Number.isFinite(Number(width)) ? Math.max(0, Number(width)) : 0;

  let navMode;
  if (safeWidth < thresholds.navDrawer) navMode = 'drawer';
  else if (preference === 'collapsed') navMode = 'rail';
  else if (preference === 'expanded') navMode = 'expanded';
  else navMode = safeWidth >= thresholds.labelsFit ? 'expanded' : 'rail';

  return { width: safeWidth, navPreference: preference, navMode, thresholds };
}

export function readNavPreference(storage) {
  try {
    return normalizedPreference(storage?.getItem?.(NAV_PREFERENCE_KEY));
  } catch {
    return 'auto';
  }
}

export function writeNavPreference(storage, value) {
  const preference = normalizedPreference(value);
  try {
    if (preference === 'auto') {
      if (typeof storage?.removeItem === 'function') storage.removeItem(NAV_PREFERENCE_KEY);
      else storage?.setItem?.(NAV_PREFERENCE_KEY, 'auto');
    } else {
      storage?.setItem?.(NAV_PREFERENCE_KEY, preference);
    }
  } catch {
    // A blocked storage API must not break the shell.
  }
  return preference;
}

function defaultTarget() {
  return typeof window === 'undefined' ? null : window;
}

function defaultWidth() {
  return typeof document === 'undefined' ? 0 : document.documentElement.clientWidth;
}

export function installShellLayout({
  shell,
  target = defaultTarget(),
  getWidth = defaultWidth,
  getPreference = () => 'auto',
  onChange = () => {},
} = {}) {
  if (!shell) return { refresh: () => null, destroy: () => {} };

  let lastMode = '';
  const refresh = () => {
    const result = resolveShellLayout({ width: getWidth(), navPreference: getPreference() });
    shell.dataset.navMode = result.navMode;
    if (result.navMode !== lastMode) {
      lastMode = result.navMode;
      onChange(result);
    }
    return result;
  };

  const onResize = () => refresh();
  target?.addEventListener?.('resize', onResize);
  refresh();

  return {
    refresh,
    destroy: () => target?.removeEventListener?.('resize', onResize),
  };
}
