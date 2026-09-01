import {
  controlState,
  registerControlPage,
  registeredControlPage,
} from './control-page-registry.js';
import { featureHeaderActionsMarkup } from './control-components.js';

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

function resourcesByKey(snapshot) {
  return new Map((snapshot?.resources || []).map(item => [item?.key, item]));
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

function mappingSummary(snapshot, groups) {
  const rows = resourcesByKey(snapshot);
  return groups.map(group => `
    <article class="community-mapping-card community-mapping-table-card">
      <div class="community-mapping-heading">
        <strong>${escapeHtml(group.label)}</strong>
        <a class="control-button control-button-secondary" href="${escapeHtml(group.href)}">Manage mappings</a>
      </div>
      <div class="community-mapping-table-wrap">
        <table class="community-mapping-table">
          <thead><tr><th>Resource</th><th>Current</th><th>Status</th></tr></thead>
          <tbody>${group.keys.map(key => {
            const row = rows.get(key);
            const current = row?.id && row?.exists ? row.name || 'Connected Discord resource' : row?.id ? 'Previously connected resource is unavailable' : 'No resource connected';
            const status = row?.id && row?.exists ? 'Connected' : row?.id ? 'Unavailable' : 'Not connected';
            const tone = row?.id && row?.exists ? 'good' : row?.id ? 'bad' : 'neutral';
            return `<tr><th scope="row">${escapeHtml(key.replaceAll('_', ' '))}</th><td>${escapeHtml(current)}</td><td class="community-mapping-status" data-tone="${tone}">${escapeHtml(status)}</td></tr>`;
          }).join('')}</tbody>
        </table>
      </div>
    </article>`).join('');
}

function statusMarkup(state) {
  if (state?.saveError) return `<p class="community-message" role="alert">${escapeHtml(state.saveError)}</p>`;
  if (state?.status === 'conflict') return '<p class="community-message" role="alert">Server state changed while you were editing. Review your draft before retrying.</p>';
  if (state?.status === 'saved') return '<p class="community-message community-message-good" role="status">Changes saved.</p>';
  return '';
}

function statePill(enabled) {
  return `<span class="community-state" data-enabled="${String(Boolean(enabled))}">${enabled ? 'Enabled' : 'Disabled'}</span>`;
}

function toggleEditor(field, label, enabled, help = '') {
  return `<label class="community-toggle-row"><span><strong>${escapeHtml(label)}</strong>${help ? `<small>${escapeHtml(help)}</small>` : ''}</span><input type="checkbox" data-community-field="${escapeHtml(field)}"${enabled ? ' checked' : ''}></label>`;
}

function saveBar(state) {
  const invalid = Boolean(Object.keys(state?.errors || {}).length);
  const disabled = !state?.dirty || invalid || state?.status === 'saving';
  return `<div class="community-page-actions"><button class="control-button control-button-primary" type="button" data-community-save${disabled ? ' disabled' : ''}>${state?.status === 'saving' ? 'Saving…' : 'Save changes'}</button><button class="control-button control-button-secondary" type="button" data-community-discard${state?.status === 'saving' ? ' disabled' : ''}>Discard</button></div>`;
}

function pageHeader(title, description, state, features) {
  return `<header class="community-page-header"><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div>${featureHeaderActionsMarkup({
    editing: state?.mode === 'edit',
    editAttribute: 'data-community-edit',
    features,
  })}</header>`;
}

function reputationMarkup(state, snapshot) {
  const value = state.mode === 'edit' ? state.draft : state.persisted;
  const mappings = mappingSummary(snapshot, [{ label: 'Reputation roles', href: '/control/mappings/roles', keys: ['builder_role', 'contributor_role', 'mentor_role'] }]);
  const header = pageHeader(
    'Reputation',
    state.mode === 'edit' ? 'Configure the feature and tier thresholds. Discord roles stay in Mappings.' : 'Current reputation status and tier thresholds.',
    state,
    [{ label: 'Reputation', enabled: value.enabled, toggleAttribute: 'data-community-field="enabled"' }],
  );
  if (state.mode === 'edit') {
    const error = state.errors?.thresholds;
    return `<section class="control-page community-page" data-page-key="${REPUTATION}">
      ${header}${statusMarkup(state)}
      <div class="community-section-grid"><fieldset class="community-fieldset"><legend>Tier thresholds</legend><p>Use strictly increasing values from 1 to 100000.</p>
        <div class="community-three-column">${['builder', 'contributor', 'mentor'].map(key => `<label>${escapeHtml(key[0].toUpperCase() + key.slice(1))}<input type="number" min="1" max="100000" step="1" data-community-threshold="${key}" value="${escapeHtml(value.thresholds[key])}"></label>`).join('')}</div>
        ${error ? `<p class="community-field-error" role="alert">${escapeHtml(error)}</p>` : ''}
      </fieldset></div>${saveBar(state)}<section class="community-mappings"><h2>Discord mappings</h2>${mappings}</section></section>`;
  }
  return `<section class="control-page community-page" data-page-key="${REPUTATION}">${header}${statusMarkup(state)}
    <div class="community-read-grid"><article class="community-summary-card"><strong>Tier thresholds</strong><dl><div><dt>Builder</dt><dd>${escapeHtml(value.thresholds.builder)}</dd></div><div><dt>Contributor</dt><dd>${escapeHtml(value.thresholds.contributor)}</dd></div><div><dt>Mentor</dt><dd>${escapeHtml(value.thresholds.mentor)}</dd></div></dl></article></div>
    <section class="community-mappings"><h2>Discord mappings</h2>${mappings}</section></section>`;
}

function questionEditor(question, index, error) {
  return `<article class="community-question-card" data-question-index="${index}">
    <div class="community-question-heading"><strong>${question.id == null ? 'New question' : `Question ${escapeHtml(question.id)}`}</strong>${question.id == null ? '<button class="control-button control-button-secondary" type="button" data-community-remove-question>Remove draft</button>' : `<label class="community-inline-toggle"><input type="checkbox" data-question-field="enabled"${question.enabled ? ' checked' : ''}> Enabled</label>`}</div>
    <div class="community-form-grid">
      <label>Category<input maxlength="50" data-question-field="category" value="${escapeHtml(question.category)}"></label>
      <label class="community-span-two">Prompt<textarea maxlength="2000" rows="3" data-question-field="prompt">${escapeHtml(question.prompt)}</textarea></label>
      ${question.options.map((option, optionIndex) => `<label>Option ${optionIndex + 1}<input maxlength="300" data-question-option="${optionIndex}" value="${escapeHtml(option)}"></label>`).join('')}
      <label>Correct answer<select data-question-field="correct">${[1, 2, 3, 4].map(value => `<option value="${value}"${question.correct === value ? ' selected' : ''}>Option ${value}</option>`).join('')}</select></label>
      <label class="community-span-two">Explanation<textarea maxlength="2000" rows="2" data-question-field="explanation">${escapeHtml(question.explanation)}</textarea></label>
    </div>${error ? `<p class="community-field-error" role="alert">${escapeHtml(error)}</p>` : ''}</article>`;
}

function quizzesMarkup(state, snapshot) {
  const value = state.mode === 'edit' ? state.draft : state.persisted;
  const count = value.questions.length;
  const mappings = mappingSummary(snapshot, [{ label: 'Quiz channel', href: '/control/mappings/channels', keys: ['quiz_channel'] }]);
  const header = pageHeader(
    'Quizzes',
    state.mode === 'edit' ? 'Configure scheduling and maintain the question bank. The quiz channel stays in Mappings.' : 'Current schedule and question-bank status.',
    state,
    [{ label: 'Scheduled quizzes', enabled: value.enabled, toggleAttribute: 'data-community-field="enabled"' }],
  );
  if (state.mode === 'edit') {
    return `<section class="control-page community-page" data-page-key="${QUIZZES}">${header}${statusMarkup(state)}
      <div class="community-section-grid"><label class="community-field-card">Interval in hours<input type="number" min="1" max="720" step="1" data-community-field="intervalHours" value="${value.intervalHours == null ? '' : escapeHtml(value.intervalHours)}" placeholder="24"><small>Between 1 and 720 hours. Leave blank if automatic scheduling is not configured.</small>${state.errors?.intervalHours ? `<span class="community-field-error" role="alert">${escapeHtml(state.errors.intervalHours)}</span>` : ''}</label></div>
      <section class="community-question-section"><div class="community-section-heading"><div><h2>Question bank</h2><p>${count} question${count === 1 ? '' : 's'} in this server.</p></div><button class="control-button control-button-secondary" type="button" data-community-add-question>Add question</button></div><div class="community-question-list">${value.questions.map((question, index) => questionEditor(question, index, state.errors?.[`question_${index}`])).join('')}</div></section>
      ${saveBar(state)}<section class="community-mappings"><h2>Discord mappings</h2>${mappings}</section></section>`;
  }
  const enabledCount = value.questions.filter(question => question.enabled).length;
  return `<section class="control-page community-page" data-page-key="${QUIZZES}">${header}${statusMarkup(state)}
    <div class="community-read-grid"><article class="community-summary-card"><strong>Schedule</strong><span>${value.intervalHours == null ? 'Not configured' : `Every ${escapeHtml(value.intervalHours)} hours`}</span><small>${value.lastPostedAt ? `Last posted ${escapeHtml(value.lastPostedAt)}` : 'No recorded post yet'}</small></article><article class="community-summary-card"><strong>Question bank</strong><span>${count} question${count === 1 ? '' : 's'}</span><small>${enabledCount} enabled</small></article></div>
    <section class="community-mappings"><h2>Discord mappings</h2>${mappings}</section></section>`;
}

function voiceCoworkingMarkup(state, snapshot) {
  const value = state.mode === 'edit' ? state.draft : state.persisted;
  const mappings = mappingSummary(snapshot, [
    { label: 'Voice channels', href: '/control/mappings/channels', keys: ['create_workspace_voice', 'coworking_lounge'] },
    { label: 'Temporary voice category', href: '/control/mappings/categories', keys: ['temp_voice_category'] },
  ]);
  const header = pageHeader(
    'Voice & Coworking',
    state.mode === 'edit' ? 'Manage the two related features independently. Their Discord resources stay in Mappings.' : 'Current feature state and Discord wiring health.',
    state,
    [
      { label: 'Temporary voice workspaces', enabled: value.voiceEnabled, toggleAttribute: 'data-community-field="voiceEnabled"' },
      { label: 'Coworking', enabled: value.coworkingEnabled, toggleAttribute: 'data-community-field="coworkingEnabled"' },
    ],
  );
  return `<section class="control-page community-page" data-page-key="${VOICE_COWORKING}">${header}${statusMarkup(state)}${state.mode === 'edit' ? saveBar(state) : ''}<section class="community-mappings"><h2>Discord mappings</h2>${mappings}</section></section>`;
}

function showcaseMarkup(state, snapshot) {
  const value = state.mode === 'edit' ? state.draft : state.persisted;
  const mappings = mappingSummary(snapshot, [{ label: 'Showcase resources', href: '/control/mappings/channels', keys: ['showcase_forum', 'app_of_the_week', 'collab_lfg'] }]);
  const header = pageHeader(
    'Showcase',
    state.mode === 'edit' ? 'Manage Showcase behavior here. Forum and destination channels stay in Mappings.' : 'Current Showcase status and Discord wiring health.',
    state,
    [{ label: 'Showcase', enabled: value.enabled, toggleAttribute: 'data-community-field="enabled"' }],
  );
  return `<section class="control-page community-page" data-page-key="${SHOWCASE}">${header}${statusMarkup(state)}${state.mode === 'edit' ? saveBar(state) : ''}<section class="community-mappings"><h2>Discord mappings</h2>${mappings}</section></section>`;
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
      if (pageKey === VOICE_COWORKING) return { voiceEnabled: featureEnabled(snapshot, 'voice'), coworkingEnabled: featureEnabled(snapshot, 'coworking') };
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
        if (persisted.coworkingEnabled !== draft.coworkingEnabled) changes.push({ action_type: 'set_feature', payload: { feature: 'coworking', enabled: draft.coworkingEnabled } });
        return changes;
      }
      if (persisted.enabled !== draft.enabled) changes.push({ action_type: 'set_feature', payload: { feature: 'showcase', enabled: draft.enabled } });
      return changes;
    },
    render({ state, snapshot } = {}) {
      return renderPage(pageKey, state, snapshot || {});
    },
    install({ root, store = controlState, onSave, rerender = () => {} } = {}) {
      return installCommunityPageInteractions({ root, pageKey, store, onSave, rerender });
    },
  };
}

export function registerCommunityPages() {
  for (const pageKey of Object.keys(COMMUNITY_PAGE_CONFIGS)) {
    if (!registeredControlPage(pageKey)) registerControlPage(createCommunityPageDefinition(pageKey));
  }
}

export function installCommunityPageInteractions({ root, pageKey, store = controlState, onSave, rerender = () => {} } = {}) {
  if (!root?.addEventListener) return () => {};
  const onClick = event => {
    if (event.target?.closest?.('[data-community-edit]')) {
      store.beginEdit(pageKey);
      rerender();
      return;
    }
    if (event.target?.closest?.('[data-community-save]')) {
      if (store.canSave(pageKey)) onSave?.(pageKey, store.buildSaveRequest(pageKey));
      return;
    }
    if (event.target?.closest?.('[data-community-discard]')) {
      store.discard(pageKey);
      store.get(pageKey).mode = 'read';
      rerender();
      return;
    }
    if (pageKey === QUIZZES && event.target?.closest?.('[data-community-add-question]')) {
      store.updateDraft(pageKey, draft => { draft.questions.push({ id: null, category: '', prompt: '', options: ['', '', '', ''], correct: 1, explanation: '', enabled: true }); });
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
  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('change', onChange);
  };
}
