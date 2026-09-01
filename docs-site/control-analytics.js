import {
  controlState,
  registerControlPage,
  registeredControlPage,
} from './control-page-registry.js';
import { featureHeaderActionsMarkup } from './control-components.js';

export const ANALYTICS_PAGE_KEY = '/control/analytics';

const RANGE_OPTIONS = Object.freeze([
  Object.freeze({ key: '1d', label: '1d' }),
  Object.freeze({ key: '3d', label: '3d' }),
  Object.freeze({ key: '7d', label: '7d' }),
  Object.freeze({ key: '2w', label: '2w' }),
  Object.freeze({ key: '1m', label: '1m' }),
  Object.freeze({ key: 'all', label: 'All time' }),
]);

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
  if (Number.isNaN(parsed.getTime())) return String(value);
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

function formatBucketPeriod(bucket) {
  return `${formatPeriod(bucket?.period_start)} – ${formatPeriod(bucket?.period_end)}`;
}

function formatAccuracy(value) {
  return value == null ? 'No answers' : `${Math.round(Number(value) * 100)}%`;
}

function metricDefinition(label, value) {
  return `
    <div class="analytics-stat">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>`;
}

function channelHealth(snapshot) {
  const resource = analyticsResource(snapshot);
  if (resource?.id && resource.exists) {
    return { current: resource.name || 'Connected text channel', status: 'Connected', tone: 'good' };
  }
  if (resource?.id) {
    return {
      current: 'Previously connected channel is unavailable',
      status: 'Unavailable',
      tone: 'bad',
    };
  }
  return { current: 'No report channel connected', status: 'Not connected', tone: 'neutral' };
}

function rangeProjection(snapshot, requestedRange) {
  const analytics = snapshot?.analytics;
  if (!analytics) return { selectedRange: '7d', projection: null };
  const ranges = analytics.ranges && typeof analytics.ranges === 'object' ? analytics.ranges : null;
  if (!ranges) return { selectedRange: '7d', projection: analytics };
  const fallback = String(analytics.default_range || '7d');
  const selectedRange = ranges[requestedRange]
    ? requestedRange
    : ranges[fallback]
      ? fallback
      : Object.keys(ranges)[0];
  return { selectedRange, projection: ranges[selectedRange] || null };
}

function rangeControlsMarkup(snapshot, selectedRange) {
  const ranges = snapshot?.analytics?.ranges || {};
  return `
    <div class="analytics-range-controls" role="group" aria-label="Analytics period">
      ${RANGE_OPTIONS.map(option => {
    const available = Boolean(ranges[option.key]);
    const selected = option.key === selectedRange;
    return `<button type="button" class="analytics-range-button" data-analytics-range="${option.key}" data-selected="${String(selected)}" aria-pressed="${String(selected)}"${available ? '' : ' disabled'}>${escapeHtml(option.label)}</button>`;
  }).join('')}
    </div>`;
}

function activityTotal(bucket) {
  return Number(bucket?.moderation_cases || 0)
    + Number(bucket?.tickets_opened || 0)
    + Number(bucket?.tickets_closed || 0)
    + Number(bucket?.quiz_answers || 0)
    + Number(bucket?.anonymous_questions || 0)
    + Number(bucket?.reputation_events || 0);
}

function analyticsChartMarkup(projection) {
  const series = Array.isArray(projection?.series) ? projection.series : [];
  if (!series.length) return '';
  const totals = series.map(activityTotal);
  const maximum = Math.max(1, ...totals);
  return `
    <section class="analytics-chart-section" aria-labelledby="analytics-chart-title">
      <div class="analytics-section-heading">
        <div><h2 id="analytics-chart-title">Activity over time</h2><p>Recorded operational events in each UTC bucket. Values come from persisted repository data only.</p></div>
      </div>
      <figure class="analytics-chart">
        <div class="analytics-chart-bars" aria-hidden="true">
          ${series.map((bucket, index) => {
    const total = totals[index];
    const height = total === 0 ? 2 : Math.max(8, Math.round((total / maximum) * 100));
    return `<span class="analytics-chart-bar" style="--analytics-bar-height:${height}%" title="${escapeHtml(`${formatBucketPeriod(bucket)}: ${total} recorded events`)}"></span>`;
  }).join('')}
        </div>
        <figcaption>Recorded activity events per UTC bucket. Open the data table for exact values.</figcaption>
      </figure>
      <details class="analytics-series-data">
        <summary>View chart data</summary>
        <div class="analytics-series-table-wrap">
          <table class="analytics-series-table">
            <thead><tr><th>Period</th><th>Moderation</th><th>Opened</th><th>Closed</th><th>Quiz answers</th><th>Accuracy</th><th>Anonymous</th><th>Reputation</th></tr></thead>
            <tbody>${series.map(bucket => `<tr><th scope="row">${escapeHtml(formatBucketPeriod(bucket))}</th><td>${escapeHtml(bucket.moderation_cases ?? 0)}</td><td>${escapeHtml(bucket.tickets_opened ?? 0)}</td><td>${escapeHtml(bucket.tickets_closed ?? 0)}</td><td>${escapeHtml(bucket.quiz_answers ?? 0)}</td><td>${escapeHtml(formatAccuracy(bucket.quiz_accuracy))}</td><td>${escapeHtml(bucket.anonymous_questions ?? 0)}</td><td>${escapeHtml(bucket.reputation_events ?? 0)}</td></tr>`).join('')}</tbody>
          </table>
        </div>
      </details>
    </section>`;
}

function analyticsReportMarkup(snapshot, requestedRange) {
  const { selectedRange, projection } = rangeProjection(snapshot, requestedRange);
  if (!projection) {
    return `
      <p class="analytics-unavailable" role="status">
        Analytics data unavailable. Refresh server state to try again.
      </p>`;
  }

  return `
    <section class="analytics-dashboard" data-active-analytics-range="${escapeHtml(selectedRange)}">
      ${rangeControlsMarkup(snapshot, selectedRange)}
      <section class="analytics-period" aria-label="Selected analytics range">
        <span><strong>From</strong> ${escapeHtml(formatPeriod(projection.period_start))}</span>
        <span><strong>To</strong> ${escapeHtml(formatPeriod(projection.period_end))}</span>
      </section>
      <dl class="analytics-metrics" aria-label="Selected period operational metrics">
        ${metricDefinition('Moderation cases', projection.moderation_cases ?? 0)}
        ${metricDefinition('Tickets opened', projection.tickets_opened ?? 0)}
        ${metricDefinition('Tickets closed', projection.tickets_closed ?? 0)}
        ${metricDefinition('Quiz answers', projection.quiz_answers ?? 0)}
        ${metricDefinition('Quiz accuracy', formatAccuracy(projection.quiz_accuracy))}
        ${metricDefinition('Anonymous questions', projection.anonymous_questions ?? 0)}
        ${metricDefinition('Reputation events', projection.reputation_events ?? 0)}
      </dl>
      ${analyticsChartMarkup(projection)}
    </section>`;
}

function reportingMarkup(state, snapshot, enabled) {
  const channel = channelHealth(snapshot);
  return `
    <section class="analytics-settings" aria-labelledby="analytics-settings-title">
      <div class="analytics-section-heading">
        <div><h2 id="analytics-settings-title">Reporting</h2><p>${state.mode === 'edit' ? 'Use the feature switch in the page header, then save or discard below.' : enabled ? 'Aggregate reporting is enabled.' : 'Aggregate reporting is disabled.'}</p></div>
        <a class="control-inline-action" href="/control/mappings/channels">Manage mappings</a>
      </div>
      <div class="control-summary-table-wrap analytics-reporting-table-wrap">
        <table class="control-summary-table analytics-reporting-table">
          <thead><tr><th>Resource</th><th>Current</th><th>Status</th></tr></thead>
          <tbody><tr><th scope="row">Report channel</th><td>${escapeHtml(channel.current)}</td><td class="control-status-text" data-tone="${channel.tone}">${escapeHtml(channel.status)}</td></tr></tbody>
        </table>
      </div>
      ${state.mode === 'edit' ? `<div class="analytics-page-actions"><button class="control-button control-button-primary" type="button" data-analytics-save${state.dirty && state.status !== 'saving' ? '' : ' disabled'}>${state.status === 'saving' ? 'Saving…' : 'Save changes'}</button><button class="control-button control-button-secondary" type="button" data-analytics-discard${state.status === 'saving' ? ' disabled' : ''}>Discard</button></div>` : ''}
    </section>`;
}

export function createAnalyticsPageDefinition() {
  let selectedRange = '7d';
  return {
    pageKey: ANALYTICS_PAGE_KEY,

    selectPersisted(snapshot) {
      const feature = analyticsFeature(snapshot);
      const availableRanges = snapshot?.analytics?.ranges || {};
      const preferred = String(snapshot?.analytics?.default_range || '7d');
      if (!availableRanges[selectedRange] && availableRanges[preferred]) selectedRange = preferred;
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
      return analyticsPageMarkup({ state, snapshot, selectedRange });
    },

    install({ root, store = controlState, onSave, rerender } = {}) {
      return installAnalyticsPageInteractions({
        root,
        store,
        onSave,
        rerender,
        onRangeChange(value) { selectedRange = value; },
      });
    },
  };
}

export function registerAnalyticsPage() {
  if (!registeredControlPage(ANALYTICS_PAGE_KEY)) {
    registerControlPage(createAnalyticsPageDefinition());
  }
}

export function analyticsPageMarkup({ state, snapshot, selectedRange } = {}) {
  if (!state?.persisted) {
    return `<section class="control-page analytics-page"><h1>Analytics</h1><p>Load current server state to view the operational snapshot.</p></section>`;
  }
  const enabled = state.mode === 'edit' ? Boolean(state.draft?.enabled) : Boolean(state.persisted?.enabled);
  const statusMarkup = state.saveError
    ? `<p class="analytics-page-message" role="alert">${escapeHtml(state.saveError)}</p>`
    : state.status === 'conflict'
      ? '<p class="analytics-page-message" role="alert">Server state changed while you were editing. Review your draft before retrying.</p>'
      : '';
  const preferredRange = selectedRange || String(snapshot?.analytics?.default_range || '7d');
  return `
    <section class="control-page analytics-page" data-page-key="${ANALYTICS_PAGE_KEY}">
      <header class="analytics-page-header"><div><h1>Analytics</h1><p>Operational activity from persisted server data.</p></div>${featureHeaderActionsMarkup({
        label: 'Analytics',
        enabled,
        editing: state.mode === 'edit',
        editAttribute: 'data-analytics-edit',
        toggleAttribute: 'data-analytics-enabled',
      })}</header>
      ${statusMarkup}
      ${analyticsReportMarkup(snapshot, preferredRange)}
      ${reportingMarkup(state, snapshot, enabled)}
    </section>`;
}

export function installAnalyticsPageInteractions({
  root,
  store = controlState,
  onSave,
  rerender = () => {},
  onRangeChange = () => {},
} = {}) {
  if (!root?.addEventListener) return () => {};

  const onClick = event => {
    const rangeButton = event.target?.closest?.('[data-analytics-range]');
    if (rangeButton && !rangeButton.disabled) {
      const value = rangeButton.getAttribute('data-analytics-range');
      if (RANGE_OPTIONS.some(option => option.key === value)) {
        onRangeChange(value);
        rerender();
      }
      return;
    }

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
