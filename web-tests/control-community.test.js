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

test('Reputation batches enable state and strict ascending thresholds without mapping or manual-adjustment ownership', async () => {
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
  assert.match(markup, /Mappings/);
});

test('Quizzes owns schedule and full question lifecycle while quiz channel stays a Mappings summary', async () => {
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
  assert.match(markup, /1 question/);
  assert.match(markup, /Mappings/);
  assert.doesNotMatch(markup, /data-resource-key|set_resource|clear_resource/i);
});

test('Voice & Coworking retains independent local feature switches', async () => {
  const { createCommunityPageDefinition } = await communityModule();
  const definition = createCommunityPageDefinition(VOICE_COWORKING);
  const snapshot = {
    features: [feature('voice', true), feature('coworking', false)],
    resources: [
      { key: 'create_workspace_voice', id: '1', name: 'Create Workspace', exists: true },
      { key: 'temp_voice_category', id: '2', name: 'Coworking', exists: true },
      { key: 'coworking_lounge', id: '3', name: 'Lounge', exists: true },
    ],
  };
  const persisted = definition.selectPersisted(snapshot);
  const draft = definition.cloneDraft(persisted);
  draft.voiceEnabled = false;
  draft.coworkingEnabled = true;
  assert.deepEqual(definition.diffDraft(persisted, draft), [
    { action_type: 'set_feature', payload: { feature: 'voice', enabled: false } },
    { action_type: 'set_feature', payload: { feature: 'coworking', enabled: true } },
  ]);
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
