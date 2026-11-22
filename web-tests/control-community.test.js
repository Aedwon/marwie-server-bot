import assert from 'node:assert/strict';
import test from 'node:test';

import { createControlStateStore } from '../docs-site/control-state.js';

const REPUTATION = '/control/community/reputation';
const QUIZZES = '/control/community/quizzes';
const VOICE_COWORKING = '/control/community/voice-coworking';
const SHOWCASE = '/control/community/showcase';

async function communityModule() {
  try {
    return await import('../docs-site/control-community.js');
  } catch (error) {
    assert.fail(`Community page module must exist: ${error.message}`);
  }
}

function feature(name, enabled) {
  return { name, enabled, config: {} };
}

function reputationSnapshot() {
  return {
    features: [feature('reputation', true)],
    reputation: { thresholds: { builder: 50, contributor: 150, mentor: 500 } },
    resources: [
      { key: 'builder_role', id: '11', name: 'Builder', exists: true },
      { key: 'contributor_role', id: '12', name: 'Contributor', exists: true },
      { key: 'mentor_role', id: '13', name: 'Mentor', exists: true },
    ],
  };
}

function quizSnapshot() {
  return {
    features: [feature('quizzes', true)],
    quiz: {
      interval_hours: 24,
      last_posted_at: '2026-08-28T00:00:00+00:00',
      questions: [
        {
          id: 7,
          category: 'python',
          prompt: 'What does len return?',
          options: ['A count', 'A string', 'A bool', 'None'],
          correct: 1,
          explanation: 'It returns an integer count.',
          enabled: true,
        },
      ],
    },
    resources: [{ key: 'quiz_channel', id: '99', name: 'quiz', exists: true }],
  };
}

test('Community page module owns all four canonical Community pages', async () => {
  const module = await communityModule();
  assert.deepEqual(Object.keys(module.COMMUNITY_PAGE_CONFIGS).sort(), [
    QUIZZES,
    REPUTATION,
    SHOWCASE,
    VOICE_COWORKING,
  ].sort());
});

test('Reputation owns feature state, thresholds and its three tier role selects', async () => {
  const { createCommunityPageDefinition } = await communityModule();
  const definition = createCommunityPageDefinition(REPUTATION);
  const persisted = definition.selectPersisted(reputationSnapshot());
  assert.deepEqual(persisted, {
    enabled: true,
    thresholds: { builder: 50, contributor: 150, mentor: 500 },
  });

  const draft = definition.cloneDraft(persisted);
  draft.enabled = false;
  draft.thresholds = { builder: 60, contributor: 160, mentor: 600 };
  assert.deepEqual(definition.diffDraft(persisted, draft), [
    { action_type: 'set_feature', payload: { feature: 'reputation', enabled: false } },
    {
      action_type: 'set_reputation_thresholds',
      payload: { builder: 60, contributor: 160, mentor: 600 },
    },
  ]);
  assert.deepEqual(definition.validateDraft(draft), {});

  draft.thresholds = { builder: 160, contributor: 160, mentor: 600 };
  assert.match(definition.validateDraft(draft).thresholds, /increase/i);

  const markup = definition.render({
    state: {
      mode: 'read',
      status: 'clean',
      persisted,
      draft: persisted,
      errors: {},
      dirty: false,
      saveError: null,
    },
    snapshot: reputationSnapshot(),
  });
  assert.doesNotMatch(markup, /Manual adjustment/i);
  assert.doesNotMatch(markup, /member_id|adjust_reputation/i);
  assert.doesNotMatch(markup, /Edit settings|data-community-edit|set_resource|clear_resource/i);
  assert.ok(markup.indexOf('data-master-row') < markup.indexOf('data-community-threshold="builder"'), 'master switch row comes first');
  for (const tier of ['builder', 'contributor', 'mentor']) {
    assert.match(markup, new RegExp(`data-community-threshold="${tier}"[^>]*value="`));
    assert.match(markup, new RegExp(`data-resource-select="${tier}_role"`));
  }
  assert.match(markup, /<span class="control-unit">pts<\/span>/);
});

test('Quizzes owns schedule, questions and a Channels section for the quiz channel', async () => {
  const { createCommunityPageDefinition } = await communityModule();
  const definition = createCommunityPageDefinition(QUIZZES);
  const persisted = definition.selectPersisted(quizSnapshot());
  assert.equal(persisted.enabled, true);
  assert.equal(persisted.intervalHours, 24);
  assert.equal(persisted.questions.length, 1);
  assert.equal(persisted.questions[0].enabled, true);

  const draft = definition.cloneDraft(persisted);
  draft.intervalHours = 12;
  draft.questions[0].prompt = 'What does len() return?';
  draft.questions[0].enabled = false;
  draft.questions.push({
    id: null,
    category: 'discord',
    prompt: 'Which permission manages server settings?',
    options: ['Manage Server', 'Mention Everyone', 'Attach Files', 'Use Voice Activity'],
    correct: 1,
    explanation: '',
    enabled: true,
  });

  assert.deepEqual(definition.diffDraft(persisted, draft), [
    { action_type: 'set_quiz_schedule', payload: { interval_hours: 12 } },
    {
      action_type: 'update_quiz_question',
      payload: {
        question_id: 7,
        category: 'python',
        prompt: 'What does len() return?',
        options: ['A count', 'A string', 'A bool', 'None'],
        correct: 1,
        explanation: 'It returns an integer count.',
      },
    },
    {
      action_type: 'set_quiz_question_enabled',
      payload: { question_id: 7, enabled: false },
    },
    {
      action_type: 'add_quiz_question',
      payload: {
        category: 'discord',
        prompt: 'Which permission manages server settings?',
        options: ['Manage Server', 'Mention Everyone', 'Attach Files', 'Use Voice Activity'],
        correct: 1,
        explanation: '',
      },
    },
  ]);
  assert.deepEqual(definition.validateDraft(draft), {});

  const markup = definition.render({
    state: {
      mode: 'read',
      status: 'clean',
      persisted,
      draft: persisted,
      errors: {},
      dirty: false,
      saveError: null,
    },
    snapshot: quizSnapshot(),
  });
  assert.doesNotMatch(markup, /Operational snapshot|Edit settings|set_resource|clear_resource/);
  assert.match(markup, /data-community-field="intervalHours"[^>]*value="24"/);
  assert.match(markup, /<span class="control-unit">hours<\/span>/);
  assert.match(markup, /<span class="control-question-prompt">What does len return\?<\/span><span class="control-question-status">In rotation<\/span>/);
  assert.match(markup, /data-resource-select="quiz_channel"/);
  assert.ok(markup.indexOf('data-master-row') < markup.indexOf('data-community-field="intervalHours"'));
});

test('Quizzes places the add-question control after the question bank', async () => {
  const { createCommunityPageDefinition } = await communityModule();
  const definition = createCommunityPageDefinition(QUIZZES);
  const persisted = definition.selectPersisted(quizSnapshot());
  const draft = definition.cloneDraft(persisted);
  const markup = definition.render({
    state: {
      mode: 'edit',
      status: 'dirty',
      persisted,
      draft,
      errors: {},
      dirty: true,
      saveError: null,
    },
    snapshot: quizSnapshot(),
  });

  const add = markup.indexOf('data-community-add-question');
  assert.ok(add > markup.indexOf('control-question-list'), 'add control must follow the list');
  assert.ok(add > markup.lastIndexOf('data-question-index'), 'add control must follow the last question');
});

test('Voice & Coworking owns the master switch, names the creator channel and lists its resources as selects', async () => {
  const { createCommunityPageDefinition } = await communityModule();
  const { withResourceBindings } = await import('../docs-site/control-resource-bindings.js');
  const { featureResourceKeys } = await import('../docs-site/control-resource-contract.js');
  const definition = withResourceBindings(
    createCommunityPageDefinition(VOICE_COWORKING),
    featureResourceKeys(VOICE_COWORKING),
    { genericContext: 'never' },
  );
  const snapshot = {
    features: [feature('voice', true), feature('coworking', false)],
    channels: [
      { id: '1', name: 'Create Workspace', type: 2 },
      { id: '3', name: 'Lounge', type: 2 },
    ],
    categories: [{ id: '2', name: 'Temporary voice', type: 4 }],
    resources: [
      { key: 'create_workspace_voice', id: '1', name: 'Create Workspace', exists: true, kind: 'voice' },
      { key: 'temp_voice_category', id: '2', name: 'Temporary voice', exists: true, kind: 'category' },
      { key: 'coworking_lounge', id: '3', name: 'Lounge', exists: true, kind: 'voice' },
    ],
  };
  const persisted = definition.selectPersisted(snapshot);
  assert.equal(persisted.voiceEnabled, true);
  assert.deepEqual(persisted.resourceBindings, {
    create_workspace_voice: '1',
    coworking_lounge: '3',
    temp_voice_category: '2',
  });
  const draft = definition.cloneDraft(persisted);
  draft.voiceEnabled = false;
  assert.deepEqual(definition.diffDraft(persisted, draft), [
    { action_type: 'set_feature', payload: { feature: 'voice', enabled: false } },
  ]);

  const state = { mode: 'read', status: 'clean', persisted, draft, errors: {}, dirty: false, saveError: null };
  const markup = definition.render({ state, snapshot });
  assert.equal(definition.renderContext({ state, snapshot }), '');
  assert.match(markup, /Joining Create Workspace gives a member their own voice room\./);
  for (const label of ['Join to create', 'New rooms go in', 'Coworking lounge']) assert.match(markup, new RegExp(label));
  for (const key of ['create_workspace_voice', 'temp_voice_category', 'coworking_lounge']) {
    assert.match(markup, new RegExp(`data-resource-select="${key}"`));
  }
  assert.match(markup, /Shared room for Pomodoro sessions/);
});

test('Showcase exposes only feature-local state and Mappings summary', async () => {
  const { createCommunityPageDefinition } = await communityModule();
  const definition = createCommunityPageDefinition(SHOWCASE);
  const snapshot = {
    features: [feature('showcase', false)],
    resources: [
      { key: 'showcase_forum', id: '7', name: 'showcase', exists: true },
      { key: 'app_of_the_week', id: '8', name: 'app-of-the-week', exists: true },
      { key: 'collab_lfg', id: '9', name: 'collab-lfg', exists: true },
    ],
  };
  const persisted = definition.selectPersisted(snapshot);
  const draft = definition.cloneDraft(persisted);
  draft.enabled = true;
  assert.deepEqual(definition.diffDraft(persisted, draft), [
    { action_type: 'set_feature', payload: { feature: 'showcase', enabled: true } },
  ]);
});

test('Community pages use the shared Control state contract for read/edit/save behavior', async () => {
  const { createCommunityPageDefinition } = await communityModule();
  const store = createControlStateStore();
  const definition = createCommunityPageDefinition(REPUTATION);
  store.register(definition);
  store.hydrate(REPUTATION, reputationSnapshot(), 'a'.repeat(64));
  assert.equal(store.get(REPUTATION).mode, 'read');
  store.beginEdit(REPUTATION);
  store.updateDraft(REPUTATION, draft => {
    draft.thresholds.builder = 55;
  });
  assert.equal(store.canSave(REPUTATION), true);
  assert.equal(store.buildSaveRequest(REPUTATION).changes[0].action_type, 'set_reputation_thresholds');
});
