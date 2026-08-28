import assert from 'node:assert/strict';
import test from 'node:test';
import { createControlStateStore } from '../docs-site/control-state.js';

const page = {
  pageKey: '/control/community/reputation',
  selectPersisted: snapshot => snapshot.reputation,
  cloneDraft: persisted => structuredClone(persisted),
  validateDraft: draft => draft.builder < draft.contributor && draft.contributor < draft.mentor ? {} : { mentor: 'Thresholds must increase.' },
  diffDraft: (persisted, draft) => persisted.builder === draft.builder && persisted.contributor === draft.contributor && persisted.mentor === draft.mentor ? [] : [{ action_type: 'set_reputation_thresholds', payload: draft }],
  buildSaveRequest: (diff, revision) => ({ page_key: '/control/community/reputation', base_revision: revision, changes: diff }),
};

function freshStore() {
  const store = createControlStateStore();
  store.register(page);
  store.hydrate('/control/community/reputation', { reputation: { builder: 50, contributor: 150, mentor: 500 } }, 'a'.repeat(64));
  return store;
}

test('ordinary draft edits are local and meaningful changes drive dirty state', () => {
  const store = freshStore();
  store.beginEdit('/control/community/reputation');
  store.updateDraft('/control/community/reputation', draft => { draft.builder = 60; });
  const state = store.get('/control/community/reputation');
  assert.equal(state.mode, 'edit');
  assert.equal(state.dirty, true);
  assert.equal(state.persisted.builder, 50);
  assert.equal(state.draft.builder, 60);
});

test('invalid drafts cannot produce save requests and discard resets from current persisted state', () => {
  const store = freshStore();
  store.beginEdit('/control/community/reputation');
  store.updateDraft('/control/community/reputation', draft => { draft.mentor = 100; });
  assert.equal(store.canSave('/control/community/reputation'), false);
  assert.throws(() => store.buildSaveRequest('/control/community/reputation'));
  store.discard('/control/community/reputation');
  assert.equal(store.get('/control/community/reputation').draft.mentor, 500);
  assert.equal(store.get('/control/community/reputation').dirty, false);
});

test('dirty drafts survive route changes in memory and successful reconciliation returns to read state', () => {
  const store = freshStore();
  store.beginEdit('/control/community/reputation');
  store.updateDraft('/control/community/reputation', draft => { draft.builder = 60; });
  const request = store.buildSaveRequest('/control/community/reputation');
  assert.deepEqual(request.changes[0].payload, { builder: 60, contributor: 150, mentor: 500 });
  store.reconcile('/control/community/reputation', { outcome: 'saved' }, { reputation: { builder: 60, contributor: 150, mentor: 500 } }, 'b'.repeat(64));
  const state = store.get('/control/community/reputation');
  assert.equal(state.mode, 'read');
  assert.equal(state.dirty, false);
  assert.equal(state.revision, 'b'.repeat(64));
});

test('partial save keeps unresolved intended differences and conflict remains distinct', () => {
  const store = freshStore();
  store.beginEdit('/control/community/reputation');
  store.updateDraft('/control/community/reputation', draft => { draft.builder = 60; });
  store.markSaving('/control/community/reputation');
  store.reconcile('/control/community/reputation', { outcome: 'partial', failed_indices: [0] }, { reputation: { builder: 50, contributor: 150, mentor: 500 } }, 'c'.repeat(64));
  assert.equal(store.get('/control/community/reputation').dirty, true);
  assert.equal(store.get('/control/community/reputation').draft.builder, 60);
  store.markConflict('/control/community/reputation', 'd'.repeat(64));
  assert.equal(store.get('/control/community/reputation').status, 'conflict');
  assert.equal(store.get('/control/community/reputation').conflictRevision, 'd'.repeat(64));
});

test('partial external failure remains retryable when persisted configuration already matches the draft', () => {
  const store = freshStore();
  const key = '/control/community/reputation';
  store.beginEdit(key);
  store.updateDraft(key, draft => { draft.builder = 60; });
  const request = store.buildSaveRequest(key);
  store.markSaving(key, request);
  store.reconcile(
    key,
    { outcome: 'partial', applied_indices: [], failed_indices: [0] },
    { reputation: { builder: 60, contributor: 150, mentor: 500 } },
    'e'.repeat(64),
  );
  const state = store.get(key);
  assert.equal(state.dirty, true);
  assert.equal(state.retryChanges.length, 1);
  const retry = store.buildSaveRequest(key);
  assert.deepEqual(retry.changes, request.changes);
  assert.equal(retry.base_revision, 'e'.repeat(64));
});
