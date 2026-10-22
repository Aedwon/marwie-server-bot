export const NAV_PREFERENCE_KEY = 'rob-control-nav-preference';

export const SHELL_METRICS = Object.freeze({
  edge: 12,
  gap: 12,
  rail: 64,
  labeled: 240,
  right: 304,
  centerMin: 600,
});

const NAV_PREFERENCES = new Set(['auto', 'expanded', 'collapsed']);

function normalizedPreference(value) {
  return NAV_PREFERENCES.has(value) ? value : 'auto';
}

export function shellThresholds() {
  const { edge, gap, rail, labeled, right, centerMin } = SHELL_METRICS;
  return {
    navDrawer: rail + centerMin + gap + (2 * edge),
    labelsNoContext: labeled + centerMin + gap + (2 * edge),
    contextRail: rail + right + centerMin + (2 * gap) + (2 * edge),
    contextLabels: labeled + right + centerMin + (2 * gap) + (2 * edge),
  };
}

export function resolveShellLayout({ width = 0, hasContext = false, navPreference = 'auto' } = {}) {
  const thresholds = shellThresholds();
  const preference = normalizedPreference(navPreference);
  const safeWidth = Number.isFinite(Number(width)) ? Math.max(0, Number(width)) : 0;

  let navMode;
  if (safeWidth < thresholds.navDrawer) {
    navMode = 'drawer';
  } else if (preference === 'collapsed') {
    navMode = 'rail';
  } else if (preference === 'expanded') {
    navMode = 'expanded';
  } else {
    const labelsFit = hasContext
      ? safeWidth >= thresholds.contextLabels
      : safeWidth >= thresholds.labelsNoContext;
    navMode = labelsFit ? 'expanded' : 'rail';
  }

  let contextMode = 'none';
  if (hasContext) {
    const floor = navMode === 'expanded' ? thresholds.contextLabels : thresholds.contextRail;
    contextMode = safeWidth >= floor ? 'column' : 'drawer';
  }

  return {
    width: safeWidth,
    hasContext: Boolean(hasContext),
    navPreference: preference,
    navMode,
    contextMode,
    thresholds,
  };
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

  let lastKey = '';
  const refresh = () => {
    const result = resolveShellLayout({
      width: getWidth(),
      hasContext: shell.dataset.context === 'true',
      navPreference: getPreference(),
    });
    shell.dataset.navMode = result.navMode;
    shell.dataset.contextMode = result.contextMode;
    const key = `${result.navMode}:${result.contextMode}`;
    if (key !== lastKey) {
      lastKey = key;
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
