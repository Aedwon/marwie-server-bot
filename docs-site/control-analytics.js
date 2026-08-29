import {
  controlState,
  registerControlPage,
  registeredControlPage,
} from './control-page-registry.js';

export const ANALYTICS_PAGE_KEY = '/control/analytics';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function analyticsFeature(snapshot) {
  return (snapshot?.features || []).find(item => item?.name === 'analytics') || null;
}

function analyticsResource(snapshot) {
  return (snapshot?.resources || []).find(item => item?.key === 'analytics') || null;
}

function formatPeriod(value) {
  if (!value) return 'Unavailable';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return escapeHtml(value);
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}

function metricDefinition(label, value) {
  return `
    <div class="analytics-stat">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>`;
}

function channelSummary(snapshot) {
  const resource = analyticsResource(snapshot);
  if (resource?.id && resource.exists) return resource.name || 'Connected text channel';
  if (resource?.id) return 'Previously connected channel is unavailable';
  return 'No report channel connected';
}

function analyticsReportMarkup(snapshot) {
  const analytics = snapshot?.analytics;
  if (!analytics) {
    return `
      <p class="analytics-unavailable" role="status">
        Analytics data unavailable. Refresh server state to try again.
      </p>`;
  }

  const accuracy = analytics.quiz_accuracy == null
    ? 'No answers in this period'
    : `${Math.round(Number(analytics.quiz_accuracy) * 100)}%`;

  return `
    <section class="analytics-period" aria-label="Analytics period">
      <span><strong>From</strong> ${escapeHtml(formatPeriod(analytics.period_start))}</span>
      <span><strong>To</strong> ${escapeHtml(formatPeriod(analytics.period_end))}</span>
    </section>
    <dl class="analytics-metrics" aria-label="Previous 7 days operational metrics">
      ${metricDefinition('Moderation cases', analytics.moderation_cases ?? 0)}
      ${metricDefinition('Tickets opened', analytics.tickets_opened ?? 0)}
      ${metricDefinition('Tickets closed', analytics.tickets_closed ?? 0)}
      ${metricDefinition('Quiz answers', analytics.quiz_answers ?? 0)}
      ${metricDefinition('Quiz accuracy', accuracy)}
      ${metricDefinition('Anonymous questions', analytics.anonymous_questions ?? 0)}
      ${metricDefinition('Reputation events', analytics.reputation_events ?? 0)}
    </dl>`;
}

export function createAnalyticsPageDefinition() {
  return {
    pageKey: ANALYTICS_PAGE_KEY,

    selectPersisted(snapshot) {
      const feature = analyticsFeature(snapshot);
      return { enabled: feature ? Boolean(feature.enabled) : true };
    },

    cloneDraft(value) {
      return { enabled: Boolean(value?.enabled) };
    },

    validateDraft() {
      return {};
    },

    diffDraft(persisted, draft) {
      const current = Boolean(persisted?.enabled);
      const next = Boolean(draft?.enabled);
      if (current === next) return [];
      return [{
        action_type: 'set_feature',
        payload: { feature: 'analytics', enabled: next },
      }];
    },

    render({ state, snapshot } = {}) {
      return analyticsPageMarkup({ state, snapshot });
    },

    install({ root, store = controlState, onSave, rerender } = {}) {
      return installAnalyticsPageInteractions({
        root,
        store,
        onSave,
        rerender,
      });
    },
  };
}

export function registerAnalyticsPage() {
  if (!registeredControlPage(ANALYTICS_PAGE_KEY)) {
    registerControlPage(createAnalyticsPageDefinition());
  }
}

export function analyticsPageMarkup({ state, snapshot } = {}) {
  if (!state?.persisted) {
    return `
      <section class="control-page analytics-page">
        <h1>Analytics</h1>
        <p>Load current server state to view the operational snapshot.</p>
      </section>`;
  }

  const enabled = state.mode === 'edit'
    ? Boolean(state.draft?.enabled)
    : Boolean(state.persisted?.enabled);
  const statusMarkup = state.saveError
    ? `<p class="analytics-page-message" role="alert">${escapeHtml(state.saveError)}</p>`
    : state.status === 'conflict'
      ? '<p class="analytics-page-message" role="alert">Server state changed while you were editing. Review your draft before retrying.</p>'
      : '';

  const settingsMarkup = state.mode === 'edit'
    ? `
      <section class="analytics-settings" aria-labelledby="analytics-settings-title">
        <div>
          <h2 id="analytics-settings-title">Reporting</h2>
          <p>Analytics owns only whether aggregate reporting is enabled.</p>
        </div>
        <label class="analytics-toggle">
          <input type="checkbox" data-analytics-enabled${enabled ? ' checked' : ''}>
          <span>Enable Analytics reporting</span>
        </label>
        <div class="analytics-page-actions">
          <button class="control-button control-button-primary" type="button" data-analytics-save${state.dirty && state.status !== 'saving' ? '' : ' disabled'}>${state.status === 'saving' ? 'Saving…' : 'Save changes'}</button>
          <button class="control-button control-button-secondary" type="button" data-analytics-discard${state.status === 'saving' ? ' disabled' : ''}>Discard</button>
        </div>
      </section>`
    : `
      <section class="analytics-settings" aria-labelledby="analytics-settings-title">
        <div>
          <h2 id="analytics-settings-title">Reporting</h2>
          <p>${enabled ? 'Aggregate reporting is enabled.' : 'Aggregate reporting is disabled.'}</p>
        </div>
        <div class="analytics-channel-row">
          <div>
            <span class="analytics-channel-label">Report channel</span>
            <strong>${escapeHtml(channelSummary(snapshot))}</strong>
          </div>
          <a href="/control/mappings/channels">Manage in Mappings</a>
        </div>
      </section>`;

  return `
    <section class="control-page analytics-page" data-page-key="${ANALYTICS_PAGE_KEY}">
      <header class="analytics-page-header">
        <div>
          <h1>Analytics</h1>
          <p>Previous 7 days · exact 168-hour UTC window.</p>
        </div>
        ${state.mode === 'edit' ? '' : '<button class="control-button control-button-primary" type="button" data-analytics-edit>Edit settings</button>'}
      </header>
      ${statusMarkup}
      ${analyticsReportMarkup(snapshot)}
      ${settingsMarkup}
    </section>`;
}

export function installAnalyticsPageInteractions({
  root,
  store = controlState,
  onSave,
  rerender = () => {},
} = {}) {
  if (!root?.addEventListener) return () => {};

  const onClick = event => {
    if (event.target?.closest?.('[data-analytics-edit]')) {
      store.beginEdit(ANALYTICS_PAGE_KEY);
      rerender();
      return;
    }

    if (event.target?.closest?.('[data-analytics-save]')) {
      if (store.canSave(ANALYTICS_PAGE_KEY)) {
        onSave?.(
          ANALYTICS_PAGE_KEY,
          store.buildSaveRequest(ANALYTICS_PAGE_KEY),
        );
      }
      return;
    }

    if (event.target?.closest?.('[data-analytics-discard]')) {
      store.discard(ANALYTICS_PAGE_KEY);
      store.get(ANALYTICS_PAGE_KEY).mode = 'read';
      rerender();
    }
  };

  const onChange = event => {
    const enabled = event.target?.closest?.('[data-analytics-enabled]');
    if (!enabled) return;
    store.updateDraft(ANALYTICS_PAGE_KEY, draft => {
      draft.enabled = Boolean(enabled.checked);
    });
    rerender();
  };

  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('change', onChange);
  };
}
