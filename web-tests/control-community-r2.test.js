import assert from 'node:assert/strict';
import test from 'node:test';

import { createControlStateStore } from '../docs-site/control-state.js';

const QUIZZES = '/control/community/quizzes';

async function communityModule() {
  return import('../docs-site/control-community.js');
}

function feature(name, enabled) {
  return { name, enabled, config: {} };
}

function question() {
  return {
    id: 7,
    category: 'python',
    prompt: 'What does len return?',
    options: ['A count', 'A string', 'A bool', 'None'],
    correct: 1,
    explanation: 'It returns an integer count.',
    enabled: true,
  };
}

function quizSnapshot(intervalHours) {
  const quiz = {
    last_posted_at: null,
    questions: [question()],
  };
  if (intervalHours !== undefined) quiz.interval_hours = intervalHours;
  return {
    features: [feature('quizzes', true)],
    quiz,
    resources: [{ key: 'quiz_channel', id: '99', name: 'quiz', exists: true }],
  };
}

function readState(persisted) {
  return {
    mode: 'read',
    status: 'clean',
    persisted,
    draft: persisted,
    errors: {},
    dirty: false,
    saveError: null,
  };
}

test('unconfigured quiz schedule remains absent in persisted Community state', async () => {
  const { createCommunityPageDefinition } = await communityModule();
  const definition = createCommunityPageDefinition(QUIZZES);

  assert.equal(definition.selectPersisted(quizSnapshot(null)).intervalHours, null);
  assert.equal(definition.selectPersisted(quizSnapshot()).intervalHours, null);
});

test('unconfigured quiz schedule renders truthfully instead of inventing 24 hours', async () => {
  const { createCommunityPageDefinition } = await communityModule();
  const definition = createCommunityPageDefinition(QUIZZES);
  const snapshot = quizSnapshot(null);
  const persisted = definition.selectPersisted(snapshot);
  const markup = definition.render({ state: readState(persisted), snapshot });

  assert.match(markup, /Not configured/i);
  assert.doesNotMatch(markup, /Every 24 hours/i);
});

test('question-only edits remain valid without creating an automatic schedule', async () => {
  const { createCommunityPageDefinition } = await communityModule();
  const definition = createCommunityPageDefinition(QUIZZES);
  const persisted = {
    enabled: true,
    intervalHours: null,
    lastPostedAt: null,
    questions: [question()],
  };
  const draft = definition.cloneDraft(persisted);
  draft.questions[0].prompt = 'What does len() return?';

  assert.deepEqual(definition.validateDraft(draft), {});
  const changes = definition.diffDraft(persisted, draft);
  assert.deepEqual(changes.map(change => change.action_type), ['update_quiz_question']);
  assert.equal(changes.some(change => change.action_type === 'set_quiz_schedule'), false);
});

test('an explicit interval configures the schedule and configured 24 renders as every 24 hours', async () => {
  const { createCommunityPageDefinition } = await communityModule();
  const definition = createCommunityPageDefinition(QUIZZES);
  const persisted = {
    enabled: true,
    intervalHours: null,
    lastPostedAt: null,
    questions: [question()],
  };
  const draft = definition.cloneDraft(persisted);
  draft.intervalHours = 24;

  assert.deepEqual(definition.validateDraft(draft), {});
  assert.deepEqual(definition.diffDraft(persisted, draft), [
    { action_type: 'set_quiz_schedule', payload: { interval_hours: 24 } },
  ]);

  const configuredSnapshot = quizSnapshot(24);
  const configured = definition.selectPersisted(configuredSnapshot);
  const markup = definition.render({ state: readState(configured), snapshot: configuredSnapshot });
  assert.match(markup, /Every 24 hours/i);
});

test('quiz interval validation accepts only explicit integers from 1 through 720 while absence stays valid', async () => {
  const { createCommunityPageDefinition } = await communityModule();
  const definition = createCommunityPageDefinition(QUIZZES);
  const base = {
    enabled: true,
    intervalHours: null,
    lastPostedAt: null,
    questions: [question()],
  };

  for (const intervalHours of [null, 1, 720]) {
    assert.deepEqual(definition.validateDraft({ ...base, intervalHours }), {});
  }
  for (const intervalHours of [0, 721, 1.5, '']) {
    assert.match(definition.validateDraft({ ...base, intervalHours }).intervalHours, /between 1 and 720/i);
  }
});

test('Discard restores the authoritative unconfigured schedule state', async () => {
  const { createCommunityPageDefinition } = await communityModule();
  const definition = createCommunityPageDefinition(QUIZZES);
  const store = createControlStateStore();
  store.register(definition);
  store.hydrate(QUIZZES, quizSnapshot(null), 'a'.repeat(64));
  store.beginEdit(QUIZZES);
  store.updateDraft(QUIZZES, draft => {
    draft.intervalHours = 24;
  });

  assert.equal(store.get(QUIZZES).dirty, true);
  store.discard(QUIZZES);
  assert.equal(store.get(QUIZZES).persisted.intervalHours, null);
  assert.equal(store.get(QUIZZES).draft.intervalHours, null);
  assert.equal(store.get(QUIZZES).dirty, false);
});
