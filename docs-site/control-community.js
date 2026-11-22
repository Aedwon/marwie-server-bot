import {
  controlState,
  registerControlPage,
  registeredControlPage,
} from './control-page-registry.js';
import {
  controlPageHeaderMarkup,
  disclosure,
  masterSwitchRow,
  numberWithUnit,
  problemLine,
  saveBarStatusMarkup,
  setDisclosureOpen,
  settingRow,
  settingsRows,
  settingsSection,
  switchMarkup,
} from './control-components.js?v=24';
import { featureResourceKeys } from './control-resource-contract.js';
import { resourceBindingState, resourceRowsMarkup, withResourceBindings } from './control-resource-bindings.js?v=2';
import { problemsFromSnapshot } from './control-problems.js?v=1';

const REPUTATION = '/control/community/reputation';
const QUIZZES = '/control/community/quizzes';
const VOICE_COWORKING = '/control/community/voice-coworking';
const SHOWCASE = '/control/community/showcase';
const DEFAULT_THRESHOLDS = Object.freeze({ builder: 50, contributor: 150, mentor: 500 });

export const COMMUNITY_PAGE_CONFIGS = Object.freeze({
  [REPUTATION]: Object.freeze({ title: 'Reputation' }),
  [QUIZZES]: Object.freeze({ title: 'Quizzes' }),
  [VOICE_COWORKING]: Object.freeze({ title: 'Voice & Coworking' }),
  [SHOWCASE]: Object.freeze({ title: 'Showcase' }),
});

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function clone(value) {
  return structuredClone(value);
}

function featureEnabled(snapshot, name) {
  return Boolean((snapshot?.features || []).find(item => item?.name === name)?.enabled);
}

function integer(value) {
  const result = Number(value);
  return Number.isInteger(result) ? result : null;
}

function normalizeQuestion(raw = {}) {
  const options = Array.isArray(raw.options) ? raw.options.slice(0, 4) : [];
  while (options.length < 4) options.push('');
  return {
    id: raw.id == null ? null : Number(raw.id),
    category: String(raw.category || ''),
    prompt: String(raw.prompt || ''),
    options: options.map(option => String(option || '')),
    correct: Number(raw.correct || 1),
    explanation: String(raw.explanation || ''),
    enabled: raw.enabled !== false,
  };
}

function questionPayload(question, includeId = false) {
  const payload = {
    category: String(question.category || '').trim(),
    prompt: String(question.prompt || '').trim(),
    options: question.options.map(option => String(option || '').trim()),
    correct: Number(question.correct),
    explanation: String(question.explanation || '').trim(),
  };
  if (includeId) payload.question_id = Number(question.id);
  return payload;
}

function sameQuestionContent(left, right) {
  return left.category === right.category
    && left.prompt === right.prompt
    && JSON.stringify(left.options) === JSON.stringify(right.options)
    && left.correct === right.correct
    && left.explanation === right.explanation;
}

function saveBar(state) {
  const invalid = Boolean(Object.keys(state?.errors || {}).length);
  const disabled = !state?.dirty || invalid || state?.status === 'saving';
  return `<div class="community-page-actions control-save-bar">${saveBarStatusMarkup(state)}<button class="control-button control-button-primary" type="button" data-community-save${disabled ? ' disabled' : ''}>${state?.status === 'saving' ? 'Saving…' : 'Save changes'}</button><button class="control-button control-button-secondary" type="button" data-community-discard${state?.status === 'saving' ? ' disabled' : ''}>Discard</button></div>`;
}

// Every converted page has the same frame: header, master switch row first, then its rows and sections.
function pageFrame(pageKey, state, { lede = '', enabled, body }) {
  return `<section class="control-page community-page" data-page-key="${pageKey}" data-master="${enabled ? 'on' : 'off'}">
    ${controlPageHeaderMarkup({ title: COMMUNITY_PAGE_CONFIGS[pageKey].title, lede, editable: false })}
    ${body}
    ${saveBar(state)}
  </section>`;
}

function resourceSection(pageKey, state, snapshot, title, { labels = {}, hints = {} } = {}) {
  const keys = featureResourceKeys(pageKey);
  const problems = problemsFromSnapshot(snapshot).filter(problem => problem.pageKey === pageKey);
  return settingsSection({
    id: `${pageKey.split('/').pop()}-resources-heading`,
    title,
    body: resourceRowsMarkup({ snapshot, state, keys, problems, labels, hints }),
  });
}

function reputationMarkup(state, snapshot) {
  const value = state.draft ?? state.persisted;
  const tiers = ['builder', 'contributor', 'mentor'];
  const rows = masterSwitchRow({
    label: 'Award reputation',
    offHint: 'Members keep their points but earn no more.',
    checked: value.enabled,
    field: 'enabled',
    attribute: 'data-community-field',
  }) + tiers.map(tier => settingRow({
    label: tier[0].toUpperCase() + tier.slice(1),
    rowKey: `threshold:${tier}`,
    controlId: `community-threshold-${tier}`,
    control: numberWithUnit({
      id: `community-threshold-${tier}`, value: value.thresholds[tier], unit: 'pts', min: 1, max: 100000, step: 1,
      attributes: `data-community-threshold="${tier}"`,
    }),
  })).join('');
  const error = state.errors?.thresholds;
  return pageFrame(REPUTATION, state, {
    enabled: value.enabled,
    body: `${settingsRows(rows, { label: 'Reputation settings' })}${error ? `<div class="control-rows-note">${problemLine(error)}</div>` : ''}
      ${resourceSection(REPUTATION, state, snapshot, 'Roles')}`,
  });
}

function questionRow(question, index, error) {
  const key = question.id == null ? `new-${index}` : question.id;
  const status = question.id == null ? 'Not saved yet' : (question.enabled ? 'In rotation' : 'Paused');
  const trigger = `<span class="control-question-copy"><span class="control-question-prompt">${escapeHtml(question.prompt || 'Untitled question')}</span><span class="control-question-status">${status}</span></span>`;
  const lead = question.id == null
    ? '<div class="control-question-actions"><button class="control-button control-button-secondary" type="button" data-community-remove-question>Remove draft</button></div>'
    : settingsRows(settingRow({
      label: 'Include in rotation',
      controlId: `community-question-${key}-enabled`,
      control: switchMarkup({ id: `community-question-${key}-enabled`, checked: question.enabled, attributes: 'data-question-field="enabled"' }),
    }));
  const body = `${lead}<div class="community-form-grid">
      <label>Category<input maxlength="50" data-question-field="category" value="${escapeHtml(question.category)}"></label>
      <label class="community-span-two">Prompt<textarea maxlength="2000" rows="3" data-question-field="prompt">${escapeHtml(question.prompt)}</textarea></label>
      ${question.options.map((option, optionIndex) => `<label>Option ${optionIndex + 1}<input maxlength="300" data-question-option="${optionIndex}" value="${escapeHtml(option)}"></label>`).join('')}
      <label>Correct answer<select data-question-field="correct">${[1, 2, 3, 4].map(number => `<option value="${number}"${question.correct === number ? ' selected' : ''}>Option ${number}</option>`).join('')}</select></label>
      <label class="community-span-two">Explanation<textarea maxlength="2000" rows="2" data-question-field="explanation">${escapeHtml(question.explanation)}</textarea></label>
    </div>${error ? problemLine(error) : ''}`;
  return `<article class="control-question" data-question-index="${index}" data-row-key="question:${question.id ?? 'new'}"${error ? ' data-problem' : ''}>${disclosure({ id: `quiz-q-${key}`, trigger, body, open: error ? true : null })}</article>`;
}

function quizzesMarkup(state, snapshot) {
  const value = state.draft ?? state.persisted;
  const interval = state.persisted.intervalHours;
  const rows = masterSwitchRow({
    label: 'Post quizzes on a schedule',
    offHint: 'Rob-bot stops posting quizzes.',
    checked: value.enabled,
    field: 'enabled',
    attribute: 'data-community-field',
  }) + settingRow({
    label: 'Posts every',
    hint: interval == null ? 'Leave blank to post only with /quiz start.' : 'Between 1 and 720 hours.',
    problem: state.errors?.intervalHours || '',
    rowKey: 'intervalHours',
    controlId: 'community-interval',
    control: numberWithUnit({
      id: 'community-interval', value: value.intervalHours, unit: 'hours', min: 1, max: 720, step: 1,
      attributes: 'data-community-field="intervalHours"',
    }),
  });
  const list = value.questions.length
    ? `<div class="control-question-list">${value.questions.map((question, index) => questionRow(question, index, state.errors?.[`question_${index}`])).join('')}</div>`
    : '<p class="control-empty-line">No questions yet. Add one to start the rotation.</p>';
  const questions = `${list}<div class="control-list-add"><button class="control-button control-button-secondary" type="button" data-community-add-question>Add question</button></div>`;
  return pageFrame(QUIZZES, state, {
    enabled: value.enabled,
    body: `${settingsRows(rows, { label: 'Quiz settings' })}
      ${resourceSection(QUIZZES, state, snapshot, 'Channels')}
      ${settingsSection({
    id: 'quiz-questions-heading',
    title: 'Questions',
    body: questions,
  })}`,
  });
}

function voiceCoworkingMarkup(state, snapshot) {
  const value = state.draft ?? state.persisted;
  const workspace = resourceBindingState(snapshot, 'create_workspace_voice');
  const rows = masterSwitchRow({
    label: 'Create voice rooms',
    offHint: 'Members cannot create voice rooms.',
    checked: value.voiceEnabled,
    field: 'voiceEnabled',
    attribute: 'data-community-field',
  });
  return pageFrame(VOICE_COWORKING, state, {
    enabled: value.voiceEnabled,
    lede: workspace.exists && workspace.name ? `Joining ${workspace.name} gives a member their own voice room.` : '',
    body: `${settingsRows(rows, { label: 'Voice settings' })}
      ${resourceSection(VOICE_COWORKING, state, snapshot, 'Channels and category', {
    labels: { create_workspace_voice: 'Join to create', temp_voice_category: 'New rooms go in' },
    hints: { coworking_lounge: 'Shared room for Pomodoro sessions' },
  })}`,
  });
}

function showcaseMarkup(state, snapshot) {
  const value = state.draft ?? state.persisted;
  const rows = masterSwitchRow({
    label: 'Run showcase spotlights',
    offHint: 'Members cannot post showcase threads.',
    checked: value.enabled,
    field: 'enabled',
    attribute: 'data-community-field',
  });
  return pageFrame(SHOWCASE, state, {
    enabled: value.enabled,
    body: `${settingsRows(rows, { label: 'Showcase settings' })}
      ${resourceSection(SHOWCASE, state, snapshot, 'Channels')}`,
  });
}

function renderPage(pageKey, state, snapshot) {
  if (!state?.persisted) return `<section class="control-page community-page"><h1>${escapeHtml(COMMUNITY_PAGE_CONFIGS[pageKey]?.title || 'Community')}</h1><p>Load current server state to manage this page.</p></section>`;
  if (pageKey === REPUTATION) return reputationMarkup(state, snapshot);
  if (pageKey === QUIZZES) return quizzesMarkup(state, snapshot);
  if (pageKey === VOICE_COWORKING) return voiceCoworkingMarkup(state, snapshot);
  return showcaseMarkup(state, snapshot);
}

function validateQuestion(question) {
  if (!String(question.category || '').trim()) return 'Category is required.';
  if (!String(question.prompt || '').trim()) return 'Prompt is required.';
  if (!Array.isArray(question.options) || question.options.length !== 4 || question.options.some(option => !String(option || '').trim())) return 'All four options are required.';
  const correct = integer(question.correct);
  if (correct === null || correct < 1 || correct > 4) return 'Correct answer must be option 1, 2, 3 or 4.';
  if (question.id == null && question.enabled === false) return 'Save a new question before disabling it.';
  return null;
}

export function createCommunityPageDefinition(pageKey) {
  if (!COMMUNITY_PAGE_CONFIGS[pageKey]) throw new Error(`Unknown Community page: ${pageKey}`);
  return {
    pageKey,
    editOnMount: true,
    selectPersisted(snapshot) {
      if (pageKey === REPUTATION) {
        const raw = snapshot?.reputation?.thresholds || DEFAULT_THRESHOLDS;
        return { enabled: featureEnabled(snapshot, 'reputation'), thresholds: {
          builder: Number(raw.builder ?? DEFAULT_THRESHOLDS.builder),
          contributor: Number(raw.contributor ?? DEFAULT_THRESHOLDS.contributor),
          mentor: Number(raw.mentor ?? DEFAULT_THRESHOLDS.mentor),
        } };
      }
      if (pageKey === QUIZZES) {
        const intervalHours = snapshot?.quiz?.interval_hours;
        return {
          enabled: featureEnabled(snapshot, 'quizzes'),
          intervalHours: intervalHours == null ? null : Number(intervalHours),
          lastPostedAt: snapshot?.quiz?.last_posted_at || null,
          questions: (snapshot?.quiz?.questions || []).map(normalizeQuestion),
        };
      }
      if (pageKey === VOICE_COWORKING) return { voiceEnabled: featureEnabled(snapshot, 'voice') };
      return { enabled: featureEnabled(snapshot, 'showcase') };
    },
    cloneDraft: clone,
    validateDraft(draft) {
      const errors = {};
      if (pageKey === REPUTATION) {
        const builder = integer(draft?.thresholds?.builder);
        const contributor = integer(draft?.thresholds?.contributor);
        const mentor = integer(draft?.thresholds?.mentor);
        if (builder === null || contributor === null || mentor === null || builder < 1 || mentor > 100000 || !(builder < contributor && contributor < mentor)) {
          errors.thresholds = 'Thresholds must increase from Builder to Contributor to Mentor and stay between 1 and 100000.';
        }
      }
      if (pageKey === QUIZZES) {
        if (draft?.intervalHours != null) {
          const interval = integer(draft.intervalHours);
          if (interval === null || interval < 1 || interval > 720) errors.intervalHours = 'Quiz interval must be between 1 and 720 hours.';
        }
        (draft?.questions || []).forEach((question, index) => {
          const error = validateQuestion(question);
          if (error) errors[`question_${index}`] = error;
        });
      }
      return errors;
    },
    diffDraft(persisted, draft) {
      const changes = [];
      if (pageKey === REPUTATION) {
        if (persisted.enabled !== draft.enabled) changes.push({ action_type: 'set_feature', payload: { feature: 'reputation', enabled: draft.enabled } });
        if (JSON.stringify(persisted.thresholds) !== JSON.stringify(draft.thresholds)) changes.push({ action_type: 'set_reputation_thresholds', payload: { builder: Number(draft.thresholds.builder), contributor: Number(draft.thresholds.contributor), mentor: Number(draft.thresholds.mentor) } });
        return changes;
      }
      if (pageKey === QUIZZES) {
        if (persisted.enabled !== draft.enabled) changes.push({ action_type: 'set_feature', payload: { feature: 'quizzes', enabled: draft.enabled } });
        const persistedInterval = persisted.intervalHours == null ? null : Number(persisted.intervalHours);
        const draftInterval = draft.intervalHours == null ? null : Number(draft.intervalHours);
        if (draftInterval !== null && persistedInterval !== draftInterval) changes.push({ action_type: 'set_quiz_schedule', payload: { interval_hours: draftInterval } });
        const existing = new Map(persisted.questions.filter(question => question.id != null).map(question => [Number(question.id), question]));
        for (const question of draft.questions) {
          if (question.id == null) {
            changes.push({ action_type: 'add_quiz_question', payload: questionPayload(question) });
            continue;
          }
          const before = existing.get(Number(question.id));
          if (!before) continue;
          if (!sameQuestionContent(before, question)) changes.push({ action_type: 'update_quiz_question', payload: questionPayload(question, true) });
          if (before.enabled !== question.enabled) changes.push({ action_type: 'set_quiz_question_enabled', payload: { question_id: Number(question.id), enabled: Boolean(question.enabled) } });
        }
        return changes;
      }
      if (pageKey === VOICE_COWORKING) {
        if (persisted.voiceEnabled !== draft.voiceEnabled) changes.push({ action_type: 'set_feature', payload: { feature: 'voice', enabled: draft.voiceEnabled } });
        return changes;
      }
      if (persisted.enabled !== draft.enabled) changes.push({ action_type: 'set_feature', payload: { feature: 'showcase', enabled: draft.enabled } });
      return changes;
    },
    render({ state, snapshot } = {}) {
      return renderPage(pageKey, state, snapshot || {});
    },
    // Context content now lives in the page as rows, problems and the Channels section.
    renderContext() {
      return '';
    },
    install({ root, store = controlState, onSave, rerender = () => {} } = {}) {
      return installCommunityPageInteractions({ root, pageKey, store, onSave, rerender });
    },
  };
}

export function registerCommunityPages() {
  for (const pageKey of Object.keys(COMMUNITY_PAGE_CONFIGS)) {
    if (!registeredControlPage(pageKey)) registerControlPage(withResourceBindings(createCommunityPageDefinition(pageKey), featureResourceKeys(pageKey), { genericContext: 'never' }));
  }
}

export function installCommunityPageInteractions({ root, pageKey, store = controlState, onSave, rerender = () => {} } = {}) {
  if (!root?.addEventListener) return () => {};
  const onClick = event => {
    if (event.target?.closest?.('[data-community-save]')) {
      if (store.canSave(pageKey)) onSave?.(pageKey, store.buildSaveRequest(pageKey));
      return;
    }
    if (event.target?.closest?.('[data-community-discard]')) {
      store.discard(pageKey);
      rerender();
      return;
    }
    if (pageKey === QUIZZES && event.target?.closest?.('[data-community-add-question]')) {
      let added = 0;
      store.updateDraft(pageKey, draft => {
        added = draft.questions.push({ id: null, category: '', prompt: '', options: ['', '', '', ''], correct: 1, explanation: '', enabled: true }) - 1;
      });
      setDisclosureOpen(`quiz-q-new-${added}`, true);
      rerender();
      return;
    }
    if (pageKey === QUIZZES && event.target?.closest?.('[data-community-remove-question]')) {
      const index = Number(event.target.closest('[data-question-index]')?.dataset?.questionIndex);
      store.updateDraft(pageKey, draft => { if (draft.questions[index]?.id == null) draft.questions.splice(index, 1); });
      rerender();
    }
  };
  const onChange = event => {
    const field = event.target?.dataset?.communityField;
    if (field) {
      store.updateDraft(pageKey, draft => {
        if (field === 'intervalHours') draft.intervalHours = Number(event.target.value);
        else draft[field] = Boolean(event.target.checked);
      });
      rerender();
      return;
    }
    const threshold = event.target?.dataset?.communityThreshold;
    if (threshold && pageKey === REPUTATION) {
      store.updateDraft(pageKey, draft => { draft.thresholds[threshold] = Number(event.target.value); });
      rerender();
      return;
    }
    if (pageKey !== QUIZZES) return;
    const card = event.target?.closest?.('[data-question-index]');
    if (!card) return;
    const index = Number(card.dataset.questionIndex);
    const questionField = event.target?.dataset?.questionField;
    const optionIndex = event.target?.dataset?.questionOption;
    if (questionField || optionIndex !== undefined) {
      store.updateDraft(pageKey, draft => {
        const question = draft.questions[index];
        if (!question) return;
        if (optionIndex !== undefined) question.options[Number(optionIndex)] = event.target.value;
        else if (questionField === 'enabled') question.enabled = Boolean(event.target.checked);
        else if (questionField === 'correct') question.correct = Number(event.target.value);
        else question[questionField] = event.target.value;
      });
      rerender();
    }
  };
  // Typed values reach the draft on every keystroke so the save bar appears at once.
  const onInput = event => {
    if (event.target?.matches?.('input[type="text"], input:not([type]), textarea')) onChange(event);
  };
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  root.addEventListener('input', onInput);
  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('change', onChange);
    root.removeEventListener('input', onInput);
  };
}
