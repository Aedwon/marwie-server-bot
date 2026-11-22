import assert from 'node:assert/strict';
import test from 'node:test';

import { saveBarView } from '../docs-site/control-components.js';
import { isNavigationBlocked } from '../docs-site/control-navigation.js';

const base = { mode: 'edit', status: 'clean', dirty: false, changeCount: 0, saveError: null, errors: {} };

test('a clean page hides the bar', () => {
  assert.equal(saveBarView(base).kind, 'hidden');
  assert.equal(saveBarView({ ...base, mode: 'read' }).visible, false);
  assert.equal(saveBarView(undefined).kind, 'hidden');
});

test('a dirty page shows the change count with Discard and Save', () => {
  const one = saveBarView({ ...base, status: 'dirty', dirty: true, changeCount: 1 });
  assert.equal(one.kind, 'dirty');
  assert.equal(one.visible, true);
  assert.equal(one.message, '1 unsaved change');
  assert.equal(one.saveLabel, 'Save changes');
  assert.equal(one.saveDisabled, false);
  assert.equal(one.discardDisabled, false);
  const many = saveBarView({ ...base, status: 'dirty', dirty: true, changeCount: 3 });
  assert.equal(many.message, '3 unsaved changes');
});

test('invalid drafts keep Save disabled', () => {
  const view = saveBarView({ ...base, status: 'dirty', dirty: true, changeCount: 1, errors: { a: 'bad' } });
  assert.equal(view.kind, 'dirty');
  assert.equal(view.saveDisabled, true);
});

test('saving shows a spinner and Saving and locks both buttons', () => {
  const view = saveBarView({ ...base, status: 'saving', dirty: true, changeCount: 2 });
  assert.equal(view.kind, 'saving');
  assert.equal(view.message, 'Saving');
  assert.equal(view.spinner, true);
  assert.equal(view.saveDisabled, true);
  assert.equal(view.discardDisabled, true);
});

test('saved shows a check and Saved and holds for 900ms', () => {
  const view = saveBarView({ ...base, mode: 'read', status: 'saved' });
  assert.equal(view.kind, 'saved');
  assert.equal(view.visible, true);
  assert.equal(view.message, 'Saved');
  assert.equal(view.check, true);
  assert.equal(view.holdMs, 900);
});

test('failure keeps the bar, shows the error sentence and renames Save to Retry', () => {
  const view = saveBarView({ ...base, status: 'dirty', dirty: true, changeCount: 1, saveError: 'The page could not be saved.' });
  assert.equal(view.kind, 'failed');
  assert.equal(view.visible, true);
  assert.equal(view.message, 'The page could not be saved.');
  assert.equal(view.saveLabel, 'Retry');
  assert.equal(view.saveDisabled, false);
});

test('conflict shows the review sentence and a Reload action', () => {
  const view = saveBarView({ ...base, status: 'conflict', dirty: true, changeCount: 1 });
  assert.equal(view.kind, 'conflict');
  assert.equal(view.message, 'Server settings changed. Review and save again.');
  assert.equal(view.showReload, true);
});

test('blocked navigation wins on a dirty page and asks to save or discard', () => {
  const view = saveBarView({ ...base, status: 'dirty', dirty: true, changeCount: 1 }, { blocked: true });
  assert.equal(view.kind, 'blocked');
  assert.equal(view.message, 'Save or discard your changes first');
  assert.equal(view.nudge, true);
  assert.equal(view.visible, true);
});

test('blocked navigation on a clean page has no effect', () => {
  assert.equal(saveBarView(base, { blocked: true }).kind, 'hidden');
});

test('navigation is blocked only when the current page is dirty and the target differs', () => {
  const store = { dirtyPages: () => ['/control/community/quizzes'] };
  assert.equal(isNavigationBlocked(store, '/control/community/quizzes', '/control/content/live'), true);
  assert.equal(isNavigationBlocked(store, '/control/community/quizzes', '/control/community/quizzes'), false);
  assert.equal(isNavigationBlocked(store, '/control/content/live', '/control/community/quizzes'), false);
  assert.equal(isNavigationBlocked({ dirtyPages: () => [] }, '/control/content/live', '/control/analytics'), false);
});
