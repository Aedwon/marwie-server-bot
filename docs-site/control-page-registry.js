import { createControlStateStore, installBeforeUnloadProtection } from './control-state.js';

export const controlState = createControlStateStore();
const registrations = new Map();

export function registerControlPage(definition) {
  controlState.register(definition);
  registrations.set(definition.pageKey, definition);
  return definition;
}

export function registeredControlPage(pageKey) {
  return registrations.get(pageKey) || null;
}

export function hydrateControlPages(snapshot, revisions = {}) {
  for (const [pageKey, definition] of registrations) {
    controlState.hydrate(pageKey, snapshot, revisions?.[pageKey] || null);
    // Converted pages edit in place: they enter edit state as soon as they hold persisted state.
    if (definition.editOnMount && controlState.get(pageKey).mode !== 'edit') controlState.beginEdit(pageKey);
  }
}

function pageContext(pageKey, context = {}) {
  return {
    pageKey,
    state: controlState.get(pageKey),
    store: controlState,
    ...context,
  };
}

export function renderRegisteredControlPage(pageKey, context = {}) {
  const definition = registeredControlPage(pageKey);
  if (!definition || typeof definition.render !== 'function') return null;
  return definition.render(pageContext(pageKey, context));
}

export function renderRegisteredControlContext(pageKey, context = {}) {
  const definition = registeredControlPage(pageKey);
  if (!definition || typeof definition.renderContext !== 'function') return '';
  return definition.renderContext(pageContext(pageKey, context)) || '';
}

export function installRegisteredControlPage(pageKey, root, context = {}) {
  const definition = registeredControlPage(pageKey);
  if (!definition || typeof definition.install !== 'function') return () => {};
  return definition.install({
    root,
    ...pageContext(pageKey, context),
  }) || (() => {});
}

export function installControlStateGuards({
  getCurrentPageKey,
  onSave,
  unloadTarget = window,
  keyboardTarget = document,
} = {}) {
  const removeUnload = installBeforeUnloadProtection(controlState, unloadTarget);
  const keydown = event => {
    if (String(event.key || '').toLowerCase() !== 's' || event.altKey || (!event.metaKey && !event.ctrlKey)) return;
    const pageKey = getCurrentPageKey?.();
    if (!pageKey || !registrations.has(pageKey) || !controlState.canSave(pageKey)) return;
    event.preventDefault();
    onSave?.(pageKey, controlState.buildSaveRequest(pageKey));
  };
  keyboardTarget.addEventListener('keydown', keydown);
  return () => {
    removeUnload();
    keyboardTarget.removeEventListener('keydown', keydown);
  };
}
