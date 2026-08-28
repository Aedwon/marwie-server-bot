import assert from 'node:assert/strict';
import test from 'node:test';
import {
  controlState,
  hydrateControlPages,
  installControlStateGuards,
  registerControlPage,
} from '../docs-site/control-page-registry.js';

const pageKey = '/control/workflows/events';
registerControlPage({
  pageKey,
  selectPersisted: snapshot => snapshot.events ?? { enabled: false },
  validateDraft: () => ({}),
  diffDraft: (persisted, draft) => persisted.enabled === draft.enabled ? [] : [
    { action_type: 'set_feature', payload: { feature: 'events', enabled: draft.enabled } },
  ],
});

test('registered pages hydrate from authoritative snapshot revision metadata', () => {
  hydrateControlPages({ events: { enabled: false } }, { [pageKey]: 'a'.repeat(64) });
  const state = controlState.get(pageKey);
  assert.equal(state.persisted.enabled, false);
  assert.equal(state.revision, 'a'.repeat(64));
});

test('Cmd/Ctrl+S is inert without a meaningful save and requests only a valid dirty page save', () => {
  const target = new EventTarget();
  const requested = [];
  const remove = installControlStateGuards({
    getCurrentPageKey: () => pageKey,
    unloadTarget: new EventTarget(),
    keyboardTarget: target,
    onSave: (key, request) => requested.push([key, request]),
  });

  let event = new Event('keydown', { cancelable: true });
  Object.assign(event, { key: 's', metaKey: true, ctrlKey: false, altKey: false });
  target.dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
  assert.equal(requested.length, 0);

  controlState.beginEdit(pageKey);
  controlState.updateDraft(pageKey, draft => { draft.enabled = true; });
  event = new Event('keydown', { cancelable: true });
  Object.assign(event, { key: 's', metaKey: true, ctrlKey: false, altKey: false });
  target.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
  assert.equal(requested.length, 1);
  assert.equal(requested[0][0], pageKey);
  assert.equal(requested[0][1].base_revision, 'a'.repeat(64));
  remove();
});

test('the Control app hydrates registered pages and installs shared state guards', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../docs-site/control-app.js', import.meta.url), 'utf8');
  assert.match(source, /hydrateControlPages\(/);
  assert.match(source, /installControlStateGuards\(/);
});

test('registered save requests use the canonical page-save client and reconcile authoritative state', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../docs-site/control-app.js', import.meta.url), 'utf8');
  assert.match(source, /enqueuePageSave\(/);
  assert.match(source, /waitForAction\(/);
  assert.match(source, /controlState\.reconcile\(/);
  assert.match(source, /loadGuildState\(/);
});
