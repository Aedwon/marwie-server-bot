const STORAGE_KEY = 'rob-doc-theme';
const VALID_PREFERENCES = new Set(['dark', 'light', 'system']);

export function resolveThemePreference(preference, systemDark) {
  const resolvedPreference = VALID_PREFERENCES.has(preference)
    ? preference
    : 'dark';

  return {
    preference: resolvedPreference,
    theme: resolvedPreference === 'system'
      ? (systemDark ? 'dark' : 'light')
      : resolvedPreference,
  };
}

export function installThemeControls({
  root,
  buttons,
  media,
  storage,
  themeColor = null,
}) {
  let currentPreference = VALID_PREFERENCES.has(storage?.getItem?.(STORAGE_KEY))
    ? storage.getItem(STORAGE_KEY)
    : 'dark';

  const apply = (preference, { persist = false } = {}) => {
    const resolved = resolveThemePreference(preference, Boolean(media?.matches));
    currentPreference = resolved.preference;
    root.dataset.preference = resolved.preference;
    root.dataset.theme = resolved.theme;

    if (persist) storage?.setItem?.(STORAGE_KEY, resolved.preference);

    for (const button of buttons || []) {
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.themeChoice === resolved.preference),
      );
    }

    if (themeColor) {
      themeColor.content = resolved.theme === 'dark' ? '#171719' : '#f5f5f7';
    }
  };

  const buttonHandlers = new Map();
  for (const button of buttons || []) {
    const handler = () => apply(button.dataset.themeChoice, { persist: true });
    buttonHandlers.set(button, handler);
    button.addEventListener('click', handler);
  }

  const mediaHandler = () => {
    if (currentPreference === 'system') apply('system');
  };
  media?.addEventListener?.('change', mediaHandler);

  apply(currentPreference);

  return () => {
    for (const [button, handler] of buttonHandlers) {
      button.removeEventListener('click', handler);
    }
    media?.removeEventListener?.('change', mediaHandler);
  };
}
