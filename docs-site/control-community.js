import {
  controlState,
  registerControlPage,
  registeredControlPage,
} from './control-page-registry.js';

const REPUTATION = '/control/community/reputation';
const QUIZZES = '/control/community/quizzes';
const VOICE_COWORKING = '/control/community/voice-coworking';
const SHOWCASE = '/control/community/showcase';

const DEFAULT_THRESHOLDS = Object.freeze({ builder: 50, contributor: 150, mentor: 500 });
const QUESTION_FIELDS = Object.freeze(['category', 'prompt', 'options', 'correct', 'explanation']);

export const COMMUNITY_PAGE_CONFIGS = Object.freeze({
  [REPUTATION]: Object.freeze({ title: 'Reputation', featureKeys: Object.freeze(['reputation']) }),
  [QUIZZES]: Object.freeze({ title: 'Quizzes', featureKeys: Object.freeze(['quizzes']) }),
  [VOICE_COWORKING]: Object.freeze({ title: 'Voice & Coworking', featureKeys: Object.freeze(['voice', 'coworking']) }),
  [SHOWCASE]: Object.freeze({ title: 'Showcase', featureKeys: Object.freeze(['showcase']) }),
});

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function featureEnabled(snapshot, name) {
  const row = (snapshot?.features || []).find(item => item?.name === name);
  return Boolean(row?.enabled);
}

function resourceRows(snapshot) {
  return new Map((snapshot?.resources || []).map(item => [item?.key, item]));
}

function clone(value) {
  return structuredClone(value);
}

function integer(value) {
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function normalizedQuestion(raw = {}) {
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

function questionContentChanged(before, after) {
  return QUESTION_FIELDS.some(field => {
    if (field === 'options') return JSON.stringify(before.options) !== JSON.stringify(after.options);
    return before[field] !== after[field];
  });
}

function mappingStatus(snapshot, keys) {
  const rows = resourceRows(snapshot);
  return keys.map(key => {
    const row = rows.get(key);
    return {
      key,
      name: row?.name || null,
      connected: Boolean(row?.id && row?.exists),
      stale: Boolean(row?.id && !row?.exists),
    };
  });
}

function mappingSummary(snapshot, groups) {
  return groups.map(group => {
    const items = mappingStatus(snapshot, group.keys);
    return `
      <article class="community-mapping-card">
        <div>
          <strong>${escapeHtml(group.label)}</strong>
          <ul>${items.map(item => `<li>${escapeHtml(item.key.replaceAll('_', ' '))}: ${escapeHtml(item.connected ? item.name : item.stale ? 'Unavailable' : 'Not connected')}</li>`).join('')}</ul>
        </div>
        <a class="control-button control-button-secondary" href="${escapeHtml(group.href)}">Mappings</a>
      </article>`;
  }).join('');
}

function statusMarkup(state) {
  if (state?.saveError) return `<p class="community-message" role="alert">${escapeHtml(state.saveError)}</p>`;
  if (state?.status === 'conflict') {
    return '<p class="community-message" role="alert">Server state changed while you were editing. Review your draft before retrying.</p>';
  }
  if (state?.status === 'saved') {
    return '<p class="community-message community-message-good" role="status">Changes saved.</p>';
  }
  return '';
}

function readStatePill(enabled) {
  return `<span class="community-state" data-enabled="${String(Boolean(enabled))}">${enabled ? 'Enabled' : 'Disabled'}</span>`;
}

function editActions(state) {
  const hasErrors = Boolean(Object.keys(state?.errors || {}).length);
  const saveDisabled = !state?.dirty || hasErrors || state?.status === 'saving';
  return `
    <div class="community-page-actions">
      <button class="control-button control-button-primary" type="button" data-community-save${saveDisabled ? ' disabled' : ''}>${state?.status === 'saving' ? 'Saving…' : 'Save changes'}</button>
      <button class="control-button control-button-secondary" type="button" data-community-discard${state?.status === 'saving' ? ' disabled' : ''}>Discard</button>
    </div>`;
}

function toggleEditor(field, label, checked, help = '') {
  return `
    <label class="community-toggle-row">
      <span><strong>${escapeHtml(label)}</strong>${help ? `<small>${escapeHtml(help)}</small>` : ''}</span>
      <input type="checkbox" data-community-field="${escapeHtml(field)}"${checked ? ' checked' : ''}>
    </label>`;
}

function reputationMarkup(state, snapshot) {
  const value = state.mode === 'edit' ? state.draft : state.persisted;
  if (state.mode === 'edit') {
    const thresholdError = state.errors?.thresholds;
    return `
      <section class="control-page community-page" data-page-key="${REPUTATION}">
        <header class="community-page-header"><div><h1>Reputation</h1><p>Configure the feature and tier thresholds. Discord roles stay in Mappings.</p></div></header>
        ${statusMarkup(state)}
        <div class="community-section-grid">
          ${toggleEditor('enabled', 'Reputation', value.enabled, 'Turn automatic reputation behavior on or off.')}
          <fieldset class="community-fieldset" aria-describedby="reputation-threshold-help${thresholdError ? ' reputation-threshold-error' : ''}">
            <legend>Tier thresholds</legend>
            <p id="reputation-threshold-help">Use strictly increasing values from 1 to 100000.</p>
            <div class="community-three-column">
              ${['builder', 'contributor', 'mentor'].map(key => `<label>${escapeHtml(key[0].toUpperCase() + key.slice(1))}<input type="number" min="1" max="100000" step="1" data-community-threshold="${key}" value="${escapeHtml(value.thresholds[key])}"></label>`).join('')}
            </div>
            ${thresholdError ? `<p class="community-field-error" id="reputation-threshold-error" role="alert">${escapeHtml(thresholdError)}</p>` : ''}
          </fieldset>
        </div>
        ${editActions(state)}
        <section class="community-mappings"><h2>Discord mappings</h2>${mappingSummary(snapshot, [{ label: 'Reputation roles', href: '/control/mappings/roles', keys: ['builder_role', 'contributor_role', 'mentor_role'] }])}</section>
      </section>`;
  }

  return `
    <section class="control-page community-page" data-page-key="${REPUTATION}">
      <header class="community-page-header"><div><h1>Reputation</h1><p>Current reputation status and tier thresholds.</p></div><button class="control-button control-button-primary" type="button" data-community-edit>Edit settings</button></header>
      ${statusMarkup(state)}
      <div class="community-read-grid">
        <article class="community-summary-card"><strong>Feature status</strong>${readStatePill(value.enabled)}</article>
        <article class="community-summary-card"><strong>Tier thresholds</strong><dl><div><dt>Builder</dt><dd>${escapeHtml(value.thresholds.builder)}</dd></div><div><dt>Contributor</dt><dd>${escapeHtml(value.thresholds.contributor)}</dd></div><div><dt>Mentor</dt><dd>${escapeHtml(value.thresholds.mentor)}</dd></div></dl></article>
      </div>
      <section class="community-mappings"><h2>Discord mappings</h2>${mappingSummary(snapshot, [{ label: 'Reputation roles', href: '/control/mappings/roles', keys: ['builder_role', 'contributor_role', 'mentor_role'] }])}</section>
    </section>`;
}

function questionEditor(question, index, error) {
  const prefix = `quiz-question-${index}`;
  return `
    <article class="community-question-card" data-question-index="${index}">
      <div class="community-question-heading">
        <strong>${question.id == null ? 'New question' : `Question ${escapeHtml(question.id)}`}</strong>
        ${question.id == null
          ? '<button class="control-button control-button-secondary" type="button" data-community-remove-question>Remove draft</button>'
          : `<label class="community-inline-toggle"><input type="checkbox" data-question-field="enabled"${question.enabled ? ' checked' : ''}> Enabled</label>`}
      </div>
      <div class="community-form-grid">
        <label>Category<input id="${prefix}-category" maxlength="50" data-question-field="category" value="${escapeHtml(question.category)}"></label>
        <label class="community-span-two">Prompt<textarea id="${prefix}-prompt" maxlength="2000" rows="3" data-question-field="prompt">${escapeHtml(question.prompt)}</textarea></label>
        ${question.options.map((option, optionIndex) => `<label>Option ${optionIndex + 1}<input maxlength="300" data-question-option="${optionIndex}" value="${escapeHtml(option)}"></label>`).join('')}
        <label>Correct answer<select data-question-field="correct">${[1, 2, 3, 4].map(value => `<option value="${value}"${question.correct === value ? ' selected' : ''}>Option ${value}</option>`).join('')}</select></label>
        <label class="community-span-two">Explanation<textarea maxlength="2000" rows="2" data-question-field="explanation">${escapeHtml(question.explanation)}</textarea></label>
      </div>
      ${error ? `<p class="community-field-error" role="alert">${escapeHtml(error)}</p>` : ''}
    </article>`;
}

function quizzesMarkup(state, snapshot) {
  const value = state.mode === 'edit' ? state.draft : state.persisted;
  const count = value.questions.length;
  if (state.mode === 'edit') {
    return `
      <section class="control-page community-page" data-page-key="${QUIZZES}">
        <header class="community-page-header"><div><h1>Quizzes</h1><p>Configure scheduling and maintain the question bank. The quiz channel stays in Mappings.</p></div></header>
        ${statusMarkup(state)}
        <div class="community-section-grid">
          ${toggleEditor('enabled', 'Scheduled quizzes', value.enabled, 'Turn scheduled quiz posting on or off.')}
          <label class="community-field-card">Interval in hours<input type="number" min="1" max="720" step="1" data-community-field="intervalHours" value="${escapeHtml(value.intervalHours)}"><small>Between 1 and 720 hours.</small>${state.errors?.intervalHours ? `<span class="community-field-error" role="alert">${escapeHtml(state.errors.intervalHours)}</span>` : ''}</label>
        </div>
        <section class="community-question-section">
          <div class="community-section-heading"><div><h2>Question bank</h2><p>${count} question${count === 1 ? '' : 's'} in this server.</p></div><button class="control-button control-button-secondary" type="button" data-community-add-question>Add question</button></div>
          <div class="community-question-list">${value.questions.map((question, index) => questionEditor(question, index, state.errors?.[`question_${index}`])).join('')}</div>
        </section>
        ${editActions(state)}
        <section class="community-mappings"><h2>Discord mappings</h2>${mappingSummary(snapshot, [{ label: 'Quiz channel', href: '/control/mappings/channels', keys: ['quiz_channel'] }])}</section>
      </section>`;
  }

  const enabledCount = value.questions.filter(question => question.enabled).length;
  return `
    <section class="control-page community-page" data-page-key="${QUIZZES}">
      <header class="community-page-header"><div><h1>Quizzes</h1><p>Current schedule and question-bank status.</p></div><button class="control-button control-button-primary" type="button" data-community-edit>Edit settings</button></header>
      ${statusMarkup(state)}
      <div class="community-read-grid">
        <article class="community-summary-card"><strong>Feature status</strong>${readStatePill(value.enabled)}</article>
        <article class="community-summary-card"><strong>Schedule</strong><span>Every ${escapeHtml(value.intervalHours)} hours</span><small>${value.lastPostedAt ? `Last posted ${escapeHtml(value.lastPostedAt)}` : 'No recorded post yet'}</small></article>
        <article class="community-summary-card"><strong>Question bank</strong><span>${count} question${count === 1 ? '' : 's'}</span><small>${enabledCount} enabled</small></article>
      </div>
      <section class="community-mappings"><h2>Discord mappings</h2>${mappingSummary(snapshot, [{ label: 'Quiz channel', href: '/control/mappings/channels', keys: ['quiz_channel'] }])}</section>
    </section>`;
}

function voiceCoworkingMarkup(state, snapshot) {
  const value = state.mode === 'edit' ? state.draft : state.persisted;
  if (state.mode === 'edit') {
    return `
      <section class="control-page community-page" data-page-key="${VOICE_COWORKING}">
        <header class="community-page-header"><div><h1>Voice & Coworking</h1><p>Manage the two related features independently. Their Discord resources stay in Mappings.</p></div></header>
        ${statusMarkup(state)}
        <div class="community-section-grid">
          ${toggleEditor('voiceEnabled', 'Temporary voice workspaces', value.voiceEnabled)}
          ${toggleEditor('coworkingEnabled', 'Coworking', value.coworkingEnabled)}
        </div>
        ${editActions(state)}
        <section class="community-mappings"><h2>Discord mappings</h2>${mappingSummary(snapshot, [
          { label: 'Voice channels', href: '/control/mappings/channels', keys: ['create_workspace_voice', 'coworking_lounge'] },
          { label: 'Temporary voice category', href: '/control/mappings/categories', keys: ['temp_voice_category'] },
        ])}</section>
      </section>`;
  }

  return `
    <section class="control-page community-page" data-page-key="${VOICE_COWORKING}">
      <header class="community-page-header"><div><h1>Voice & Coworking</h1><p>Current feature state and Discord wiring health.</p></div><button class="control-button control-button-primary" type="button" data-community-edit>Edit settings</button></header>
      ${statusMarkup(state)}
      <div class="community-read-grid"><article class="community-summary-card"><strong>Temporary voice workspaces</strong>${readStatePill(value.voiceEnabled)}</article><article class="community-summary-card"><strong>Coworking</strong>${readStatePill(value.coworkingEnabled)}</article></div>
      <section class="community-mappings"><h2>Discord mappings</h2>${mappingSummary(snapshot, [
        { label: 'Voice channels', href: '/control/mappings/channels', keys: ['create_workspace_voice', 'coworking_lounge'] },
        { label: 'Temporary voice category', href: '/control/mappings/categories', keys: ['temp_voice_category'] },
      ])}</section>
    </section>`;
}

function showcaseMarkup(state, snapshot) {
  const value = state.mode === 'edit' ? state.draft : state.persisted;
  if (state.mode === 'edit') {
    return `
      <section class="control-page community-page" data-page-key="${SHOWCASE}">
        <header class="community-page-header"><div><h1>Showcase</h1><p>Manage Showcase behavior here. Forum and destination channels stay in Mappings.</p></div></header>
        ${statusMarkup(state)}
        <div class="community-section-grid">${toggleEditor('enabled', 'Showcase', value.enabled, 'Turn Showcase and spotlight behavior on or off.')}</div>
        ${editActions(state)}
        <section class="community-mappings"><h2>Discord mappings</h2>${mappingSummary(snapshot, [{ label: 'Showcase resources', href: '/control/mappings/channels', keys: ['showcase_forum', 'app_of_the_week', 'collab_lfg'] }])}</section>
      </section>`;
  }

  return `
    <section class="control-page community-page" data-page-key="${SHOWCASE}">
      <header class="community-page-header"><div><h1>Showcase</h1><p>Current Showcase status and Discord wiring health.</p></div><button class="control-button control-button-primary" type="button" data-community-edit>Edit settings</button></header>
      ${statusMarkup(state)}
      <div class="community-read-grid"><article class="community-summary-card"><strong>Feature status</strong>${readStatePill(value.enabled)}</article></div>
      <section class="community-mappings"><h2>Discord mappings</h2>${mappingSummary(snapshot, [{ label: 'Showcase resources', href: '/control/mappings/channels', keys: ['showcase_forum', 'app_of_the_week', 'collab_lfg'] }])}</section>
    </section>`;
}

function renderPage(pageKey, state, snapshot) {
  if (!state?.persisted) {
    const title = COMMUNITY_PAGE_CONFIGS[pageKey]?.title || 'Community';
    return `<section class="control-page community-page"><h1>${escapeHtml(title)}</h1><p>Load current server state to manage this page.</p></section>`;
  }
  if (pageKey === REPUTATION) return reputationMarkup(state, snapshot);
  if (pageKey === QUIZZES) return quizzesMarkup(state, snapshot);
  if (pageKey === VOICE_COWORKING) return voiceCoworkingMarkup(state, snapshot);
  if (pageKey === SHOWCASE) return showcaseMarkup(state, snapshot);
  return '';
}

function validateQuestion(question) {
  if (!String(question.category || '').trim()) return 'Category is required.';
  if (!String(question.prompt || '').trim()) return 'Prompt is required.';
  if (!Array.isArray(question.options) || question.options.length !== 4 || question.options.some(option => !String(option || '').trim())) {
    return 'All four options are required.';
  }
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
        return {
          enabled: featureEnabled(snapshot, 'reputation'),
          thresholds: {
            builder: Number(raw.builder ?? DEFAULT_THRESHOLDS.builder),
            contributor: Number(raw.contributor ?? DEFAULT_THRESHOLDS.contributor),
            mentor: Number(raw.mentor ?? DEFAULT_THRESHOLDS.mentor),
          },
        };
      }
      if (pageKey === QUIZZES) {
        return {
          enabled: featureEnabled(snapshot, 'quizzes'),
          intervalHours: Number(snapshot?.quiz?.interval_hours ?? 24),
          lastPostedAt: snapshot?.quiz?.last_posted_at || null,
          questions: (snapshot?.quiz?.questions || []).map(normalizedQuestion),
        };
      }
      if (pageKey === VOICE_COWORKING) {
        return {
          voiceEnabled: featureEnabled(snapshot, 'voice'),
          coworkingEnabled: featureEnabled(snapshot, 'coworking'),
        };
      }
      return { enabled: featureEnabled(snapshot, 'showcase') };
    },

    cloneDraft(value) {
      return clone(value);
    },

    validateDraft(draft) {
      const errors = {};
      if (pageKey === REPUTATION) {
        const builder = integer(draft?.thresholds?.builder);
        const contributor = integer(draft?.thresholds?.contributor);
        const mentor = integer(draft?.thresholds?.mentor);
        if (
          builder === null || contributor === null || mentor === null
          || builder < 1 || mentor > 100000
          || !builder < contributor || !contributor < mentor
        ) {
          errors.thresholds = 'Thresholds must increase from Builder to Contributor to Mentor and stay between 1 and 100000.';
        }
      }
      if (pageKey === QUIZZES) {
        const interval = integer(draft?.intervalHours);
        if (interval === null || interval < 1 || interval > 720) {
          errors.intervalHours = 'Quiz interval must be between 1 and 720 hours.';
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
        if (persisted.enabled !== draft.enabled) {
          changes.push({ action_type: 'set_feature', payload: { feature: 'reputation', enabled: draft.enabled } });
        }
        if (JSON.stringify(persisted.thresholds) !== JSON.stringify(draft.thresholds)) {
          changes.push({ action_type: 'set_reputation_thresholds', payload: {
            builder: Number(draft.thresholds.builder),
            contributor: Number(draft.thresholds.contributor),
            mentor: Number(draft.thresholds.mentor),
          } });
        }
        return changes;
      }

      if (pageKey === QUIZZES) {
        if (persisted.enabled !== draft.enabled) {
          changes.push({ action_type: 'set_feature', payload: { feature: 'quizzes', enabled: draft.enabled } });
        }
        if (Number(persisted.intervalHours) !== Number(draft.intervalHours)) {
          changes.push({ action_type: 'set_quiz_schedule', payload: { interval_hours: Number(draft.intervalHours) } });
        }
        const persistedById = new Map(persisted.questions.filter(question => question.id != null).map(question => [Number(question.id), question]));
        for (const question of draft.questions) {
          if (question.id == null) {
            changes.push({ action_type: 'add_quiz_question', payload: questionPayload(question) });
            continue;
          }
          const before = persistedById.get(Number(question.id));
          if (!before) continue;
          if (questionContentChanged(before, question)) {
            changes.push({ action_type: 'update_quiz_question', payload: questionPayload(question, true) });
          }
          if (before.enabled !== question.enabled) {
            changes.push({ action_type: 'set_quiz_question_enabled', payload: { question_id: Number(question.id), enabled: Boolean(question.enabled) } });
          }
        }
        return changes;
      }

      if (pageKey === VOICE_COWORKING) {
        if (persisted.voiceEnabled !== draft.voiceEnabled) {
          changes.push({ action_type: 'set_feature', payload: { feature: 'voice', enabled: draft.voiceEnabled } });
        }
        if (persisted.coworkingEnabled !== draft.coworkingEnabled) {
          changes.push({ action_type: 'set_feature', payload: { feature: 'coworking', enabled: draft.coworkingEnabled } });
        }
        return changes;
      }

      if (persisted.enabled !== draft.enabled) {
        changes.push({ action_type: 'set_feature', payload: { feature: 'showcase', enabled: draft.enabled } });
      }
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

function updateField(store, pageKey, field, target) {
  store.updateDraft(pageKey, draft => {
    if (field === 'enabled' || field === 'voiceEnabled' || field === 'coworkingEnabled') {
      draft[field] = Boolean(target.checked);
      return;
    }
    if (field === 'intervalHours') draft.intervalHours = Number(target.value);
  });
}

export function installCommunityPageInteractions({
  root,
  pageKey,
  store = controlState,
  onSave,
  rerender = () => {},
} = {}) {
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
      store.updateDraft(pageKey, draft => {
        draft.questions.push({
          id: null,
          category: '',
          prompt: '',
          options: ['', '', '', ''],
          correct: 1,
          explanation: '',
          enabled: true,
        });
      });
      rerender();
      return;
    }
    if (pageKey === QUIZZES && event.target?.closest?.('[data-community-remove-question]')) {
      const card = event.target.closest('[data-question-index]');
      const index = Number(card?.dataset?.questionIndex);
      store.updateDraft(pageKey, draft => {
        if (draft.questions[index]?.id == null) draft.questions.splice(index, 1);
      });
      rerender();
    }
  };

  const onChange = event => {
    const field = event.target?.dataset?.communityField;
    if (field) {
      updateField(store, pageKey, field, event.target);
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
