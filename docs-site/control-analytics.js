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

function niceActivityMaximum(maximum) {
  const value = Math.max(1, Number(maximum) || 0);
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}

function xTickIndexes(length, maximumTicks = 6) {
  if (length <= 0) return [];
  if (length <= maximumTicks) return Array.from({ length }, (_, index) => index);
  const last = length - 1;
  const indexes = new Set([0, last]);
  for (let tick = 1; tick < maximumTicks - 1; tick += 1) {
    indexes.add(Math.round((last * tick) / (maximumTicks - 1)));
  }
  return [...indexes].sort((left, right) => left - right);
}

function formatAxisBucket(bucket, selectedRange) {
  const parsed = new Date(bucket?.period_start);
  if (Number.isNaN(parsed.getTime())) return '';
  const shortRange = selectedRange === '1d' || selectedRange === '3d';
  return new Intl.DateTimeFormat(undefined, shortRange
    ? { hour: 'numeric', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' }
    : { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(parsed);
}

function analyticsChartMarkup(projection, selectedRange) {
  const series = Array.isArray(projection?.series) ? projection.series : [];
  if (!series.length) return '';

  const totals = series.map(activityTotal);
  const maximum = niceActivityMaximum(Math.max(0, ...totals));
  const width = 720;
  const height = 280;
  const margin = { top: 18, right: 18, bottom: 50, left: 54 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const xFor = index => series.length === 1
    ? margin.left + (plotWidth / 2)
    : margin.left + ((index / (series.length - 1)) * plotWidth);
  const yFor = total => margin.top + plotHeight - ((total / maximum) * plotHeight);
  const points = totals.map((total, index) => `${xFor(index).toFixed(2)},${yFor(total).toFixed(2)}`);
  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const value = (maximum * index) / 4;
    return {
      value,
      y: yFor(value),
      label: Number.isInteger(value) ? String(value) : value.toFixed(1),
    };
  });
  const xTicks = xTickIndexes(series.length).map(index => ({
    index,
    x: xFor(index),
    label: formatAxisBucket(series[index], selectedRange),
  }));
  const summary = `${series.length} real UTC bucket${series.length === 1 ? '' : 's'} are plotted for ${selectedRange === 'all' ? 'All time' : selectedRange}. Activity ranges from ${Math.min(...totals)} to ${Math.max(...totals)} events per supplied bucket.`;

  return `
    <section class="analytics-chart-section" aria-labelledby="analytics-chart-title">
      <div class="analytics-section-heading"><h2 id="analytics-chart-title">Activity over time</h2></div>
      <figure class="analytics-chart">
        <svg class="analytics-line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="analytics-chart-title analytics-line-chart-summary" preserveAspectRatio="xMidYMid meet">
          <desc id="analytics-line-chart-summary">${escapeHtml(summary)}</desc>
          <g class="analytics-axis analytics-axis-y" aria-hidden="true">
            <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}"></line>
            ${yTicks.map(tick => `<g class="analytics-axis-tick"><line x1="${margin.left - 5}" y1="${tick.y.toFixed(2)}" x2="${margin.left}" y2="${tick.y.toFixed(2)}"></line><text x="${margin.left - 9}" y="${(tick.y + 4).toFixed(2)}" text-anchor="end">${escapeHtml(tick.label)}</text></g>`).join('')}
            <text class="analytics-axis-label" x="14" y="${margin.top + (plotHeight / 2)}" text-anchor="middle" transform="rotate(-90 14 ${margin.top + (plotHeight / 2)})">Activity count</text>
          </g>
          <g class="analytics-axis analytics-axis-x" aria-hidden="true">
            <line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${margin.left + plotWidth}" y2="${margin.top + plotHeight}"></line>
            ${xTicks.map(tick => `<g class="analytics-axis-tick"><line x1="${tick.x.toFixed(2)}" y1="${margin.top + plotHeight}" x2="${tick.x.toFixed(2)}" y2="${margin.top + plotHeight + 5}"></line><text x="${tick.x.toFixed(2)}" y="${margin.top + plotHeight + 20}" text-anchor="middle">${escapeHtml(tick.label)}</text></g>`).join('')}
            <text class="analytics-axis-label" x="${margin.left + (plotWidth / 2)}" y="${height - 6}" text-anchor="middle">UTC time / date</text>
          </g>
          ${series.length > 1 ? `<polyline class="analytics-line-path" points="${points.join(' ')}" fill="none"></polyline>` : ''}
          ${series.map((bucket, index) => `<circle class="analytics-line-point" cx="${xFor(index).toFixed(2)}" cy="${yFor(totals[index]).toFixed(2)}" r="4" data-analytics-point="${index}"><title>${escapeHtml(`${formatBucketPeriod(bucket)}: ${totals[index]} activity events`)}</title></circle>`).join('')}
        </svg>
        <figcaption>Activity count per supplied UTC bucket from persisted server data.</figcaption>
      </figure>
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
      <div class="analytics-range-row">
        <section class="analytics-period" aria-label="Selected analytics range">
          <span><strong>From</strong> ${escapeHtml(formatPeriod(projection.period_start))}</span>
          <span><strong>To</strong> ${escapeHtml(formatPeriod(projection.period_end))}</span>
        </section>
        ${rangeControlsMarkup(snapshot, selectedRange)}
      </div>
      <dl class="analytics-metrics" aria-label="Selected period operational metrics">
        ${metricDefinition('Moderation cases', projection.moderation_cases ?? 0)}
        ${metricDefinition('Tickets opened', projection.tickets_opened ?? 0)}
        ${metricDefinition('Tickets closed', projection.tickets_closed ?? 0)}
        ${metricDefinition('Quiz answers', projection.quiz_answers ?? 0)}
        ${metricDefinition('Quiz accuracy', formatAccuracy(projection.quiz_accuracy))}
        ${metricDefinition('Anonymous questions', projection.anonymous_questions ?? 0)}
        ${metricDefinition('Reputation events', projection.reputation_events ?? 0)}
      </dl>
      ${analyticsChartMarkup(projection, selectedRange)}
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
