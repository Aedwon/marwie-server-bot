function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function hasErrors(errors) {
  return Boolean(errors && Object.keys(errors).length);
}

function pageState(definition) {
  return {
    definition,
    pageKey: definition.pageKey,
    mode: 'read',
    status: 'clean',
    persisted: undefined,
    draft: undefined,
    revision: null,
    dirty: false,
    errors: {},
    saveError: null,
    conflictRevision: null,
    savedAt: null,
  };
}

function recalculate(state) {
  if (state.draft === undefined || state.persisted === undefined) {
    state.dirty = false;
    state.errors = {};
    return state;
  }
  state.errors = state.definition.validateDraft?.(state.draft) || {};
  const diff = state.definition.diffDraft(state.persisted, state.draft) || [];
  state.dirty = diff.length > 0;
  if (state.status !== 'saving' && state.status !== 'conflict') {
    state.status = state.dirty ? 'dirty' : 'clean';
  }
  return state;
}

export function createControlStateStore() {
  const definitions = new Map();
  const states = new Map();

  function requireState(pageKey) {
    const state = states.get(pageKey);
    if (!state) throw new Error(`Control page is not registered: ${pageKey}`);
    return state;
  }

  return {
    register(definition) {
      if (!definition?.pageKey || typeof definition.selectPersisted !== 'function') {
        throw new Error('A page registration requires pageKey and selectPersisted.');
      }
      if (definitions.has(definition.pageKey)) throw new Error(`Duplicate page registration: ${definition.pageKey}`);
      definitions.set(definition.pageKey, definition);
      states.set(definition.pageKey, pageState(definition));
      return this;
    },

    hydrate(pageKey, snapshot, revision) {
      const state = requireState(pageKey);
      const persisted = state.definition.selectPersisted(snapshot);
      state.persisted = clone(persisted);
      state.revision = revision || null;
      state.conflictRevision = null;
      state.saveError = null;
      if (state.draft === undefined || !state.dirty) {
        state.draft = state.definition.cloneDraft
          ? state.definition.cloneDraft(state.persisted)
          : clone(state.persisted);
      }
      recalculate(state);
      return state;
    },

    beginEdit(pageKey) {
      const state = requireState(pageKey);
      if (state.persisted === undefined) throw new Error('Persisted page state must be hydrated before editing.');
      state.mode = 'edit';
      state.status = state.dirty ? 'dirty' : 'clean';
      return state;
    },

    updateDraft(pageKey, updater) {
      const state = requireState(pageKey);
      if (state.mode !== 'edit') throw new Error('Edit settings before changing this page.');
      const next = state.definition.cloneDraft ? state.definition.cloneDraft(state.draft) : clone(state.draft);
      const returned = updater(next);
      state.draft = returned === undefined ? next : returned;
      state.saveError = null;
      if (state.status === 'conflict') state.status = 'dirty';
      state.conflictRevision = null;
      return recalculate(state);
    },

    discard(pageKey) {
      const state = requireState(pageKey);
      state.draft = state.definition.cloneDraft
        ? state.definition.cloneDraft(state.persisted)
        : clone(state.persisted);
      state.errors = {};
      state.dirty = false;
      state.saveError = null;
      state.conflictRevision = null;
      state.status = 'clean';
      return state;
    },

    canSave(pageKey) {
      const state = requireState(pageKey);
      return state.mode === 'edit'
        && state.dirty
        && !hasErrors(state.errors)
        && state.status !== 'saving'
        && Boolean(state.revision);
    },

    buildSaveRequest(pageKey) {
      const state = requireState(pageKey);
      recalculate(state);
      if (!this.canSave(pageKey)) throw new Error('This page does not have a meaningful valid save target.');
      const diff = state.definition.diffDraft(state.persisted, state.draft) || [];
      return state.definition.buildSaveRequest
        ? state.definition.buildSaveRequest(diff, state.revision)
        : { page_key: pageKey, base_revision: state.revision, changes: diff };
    },

    markSaving(pageKey) {
      const state = requireState(pageKey);
      if (!this.canSave(pageKey)) throw new Error('This page cannot be saved in its current state.');
      state.status = 'saving';
      state.saveError = null;
      return state;
    },

    markSaveError(pageKey, error) {
      const state = requireState(pageKey);
      state.status = state.dirty ? 'dirty' : 'clean';
      state.saveError = String(error || 'Save failed.');
      return state;
    },

    markConflict(pageKey, currentRevision) {
      const state = requireState(pageKey);
      state.status = 'conflict';
      state.conflictRevision = currentRevision || null;
      return state;
    },

    reconcile(pageKey, result, snapshot, revision) {
      const state = requireState(pageKey);
      const persisted = state.definition.selectPersisted(snapshot);
      state.persisted = clone(persisted);
      state.revision = revision || state.revision;
      state.saveError = null;
      state.conflictRevision = null;

      if (result?.outcome === 'saved') {
        state.draft = state.definition.cloneDraft
          ? state.definition.cloneDraft(state.persisted)
          : clone(state.persisted);
        state.dirty = false;
        state.errors = {};
        state.mode = 'read';
        state.status = 'saved';
        state.savedAt = Date.now();
        return state;
      }

      if (result?.outcome === 'conflict') {
        state.status = 'conflict';
        state.conflictRevision = result.current_revision || revision || null;
        return recalculate(state);
      }

      // Partial external failure keeps the user's unresolved intended draft.
      state.mode = 'edit';
      state.status = 'dirty';
      return recalculate(state);
    },

    settleSaved(pageKey) {
      const state = requireState(pageKey);
      if (state.status === 'saved') state.status = 'clean';
      return state;
    },

    get(pageKey) {
      return requireState(pageKey);
    },

    dirtyPages() {
      return [...states.values()].filter(state => state.dirty).map(state => state.pageKey);
    },

    hasDirty() {
      return [...states.values()].some(state => state.dirty);
    },
  };
}

export function installBeforeUnloadProtection(store, target = window) {
  const handler = event => {
    if (!store.hasDirty()) return;
    event.preventDefault();
    event.returnValue = '';
  };
  target.addEventListener('beforeunload', handler);
  return () => target.removeEventListener('beforeunload', handler);
}
