import {
  controlState,
  registerControlPage,
  registeredControlPage,
} from './control-page-registry.js';
import { contextDefinitionListMarkup, contextSectionMarkup, controlPageHeaderMarkup, saveBarStatusMarkup } from './control-components.js?v=22';
import { featureResourceKeys } from './control-resource-contract.js';
import { resourceBindingState, withResourceBindings } from './control-resource-bindings.js';

export const ANALYTICS_PAGE_KEY = '/control/analytics';

const RANGE_OPTIONS = Object.freeze([
  Object.freeze({ key: '1d', label: '1d' }),
  Object.freeze({ key: '3d', label: '3d' }),
  Object.freeze({ key: '7d', label: '7d' }),
  Object.freeze({ key: '2w', label: '2w' }),
  Object.freeze({ key: '1m', label: '1m' }),
  Object.freeze({ key: 'all', label: 'All time' }),
]);

const V2_FIELDS = [
  'open_ticket_backlog', 'ticket_median_close_seconds', 'tickets_reopened', 'anonymous_messages',
  'coverage', 'human_messages', 'voice_member_minutes',
];
const COVERAGE_FAMILIES = [
  ['business_events', 'Business events'],
  ['messages', 'Messages'],
  ['voice', 'Voice'],
];
const COVERAGE_STATES = {
  complete: { label: 'Complete', tone: 'good' },
  partial: { label: 'Partial', tone: 'warning' },
  unavailable: { label: 'Unavailable' },
};
const PASSIVE_METRICS = [
  { field: 'human_messages', family: 'messages', label: 'Human messages', unit: '' },
  { field: 'voice_member_minutes', family: 'voice', label: 'Voice member minutes', unit: ' min' },
];
const OPERATIONAL_EVENTS = [
  ['moderation_cases', 'Moderation cases'],
  ['tickets_opened', 'Tickets opened'],
  ['tickets_closed', 'Tickets closed'],
  ['tickets_reopened', 'Tickets reopened'],
  ['quiz_answers', 'Quiz answers'],
  ['anonymous_questions', 'Anonymous questions'],
  ['anonymous_messages', 'Anonymous messages'],
  ['reputation_events', 'Reputation events'],
];

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

export function isAnalyticsV2(snapshot, projection) {
  return Number(snapshot?.analytics?.schema_version) >= 2
    || V2_FIELDS.some(field => Object.hasOwn(projection ?? {}, field));
}

export function selectAnalyticsCoverage(snapshot, projection) {
  if (projection?.coverage && typeof projection.coverage === 'object') return projection.coverage;
  const analytics = snapshot?.analytics;
  if (!analytics?.coverage || typeof analytics.coverage !== 'object') return null;
  const hasRanges = Boolean(analytics.ranges && typeof analytics.ranges === 'object');
  const defaultRange = String(analytics.default_range || '7d');
  if (!hasRanges || projection?.range_key === defaultRange) return analytics.coverage;
  return null;
}

export function formatDurationSeconds(seconds, { ticketsClosed } = {}) {
  if (seconds == null || !Number.isFinite(Number(seconds))) {
    return ticketsClosed === 0 ? 'No closures' : 'Unavailable';
  }
  const total = Math.max(0, Math.round(Number(seconds)));
  const minutes = Math.floor(total / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days) return [`${days}d`, hours % 24 && `${hours % 24}h`].filter(Boolean).join(' ');
  if (hours) return [`${hours}h`, minutes % 60 && `${minutes % 60}m`].filter(Boolean).join(' ');
  if (minutes) return [`${minutes}m`, total % 60 && `${total % 60}s`].filter(Boolean).join(' ');
  return `${total}s`;
}

export function formatLocalTimestamp(value, { locale, timeZone } = {}) {
  if (value == null || value === '') return 'Unavailable';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  }).format(parsed);
}

function formatAccuracy(value) {
  return value == null ? 'No answers' : `${Math.round(Number(value) * 100)}%`;
}

function metricDefinition(label, value) {
  return `
    <div class="control-stat-row">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>`;
}

function coverageDetail(entry) {
  if (entry.note != null) return String(entry.note);
  if (entry.status === 'complete' && !entry.gap_count && !entry.dropped_events) return '';
  const parts = [`${Math.round(Number(entry.covered_ratio || 0) * 100)}% covered`];
  if (entry.gap_count > 0) parts.push(`${entry.gap_count} ${entry.gap_count === 1 ? 'gap' : 'gaps'}`);
  if (entry.dropped_events > 0) parts.push(`${entry.dropped_events} dropped`);
  return parts.join(' · ');
}

function coverageListMarkup(coverage) {
  if (!coverage) return '';
  return `
    <ul class="analytics-coverage-list" aria-label="Data coverage">
      ${COVERAGE_FAMILIES.map(([family, label]) => {
    const entry = coverage[family];
    if (!entry) return '';
    const { label: status, tone } = COVERAGE_STATES[entry.status] ?? COVERAGE_STATES.unavailable;
    const detail = coverageDetail(entry);
    return `<li class="analytics-coverage-item">
      <span>${label}</span>
      <span class="control-state-chip"${tone ? ` data-tone="${tone}"` : ''}>${status}</span>
      ${detail ? `<span class="analytics-coverage-note">${escapeHtml(detail)}</span>` : ''}
    </li>`;
  }).join('')}
    </ul>`;
}

function hasPassiveCount(value, status) {
  return value != null && (status === 'complete' || status === 'partial');
}

function passiveSectionMarkup(projection, coverage) {
  return `
    <section class="analytics-passive-section" aria-labelledby="analytics-passive-title">
      <div class="analytics-section-heading"><h2 id="analytics-passive-title">Passive telemetry</h2></div>
      <dl class="control-stat-list">
        ${PASSIVE_METRICS.map(({ field, family, label, unit }) => {
    const value = projection[field];
    const status = coverage?.[family]?.status;
    if (!hasPassiveCount(value, status)) return metricDefinition(label, 'Unavailable');
    return metricDefinition(label, `${value}${unit}${status === 'partial' ? ' (partial)' : ''}`);
  }).join('')}
      </dl>
      ${coverageListMarkup(coverage)}
    </section>`;
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
  return OPERATIONAL_EVENTS.reduce((total, [field]) => total + Number(bucket?.[field] || 0), 0);
}

function bucketSummary(bucket, total, clock) {
  const start = formatLocalTimestamp(bucket?.period_start, clock);
  const end = formatLocalTimestamp(bucket?.period_end, clock);
  const parts = [`${start} to ${end}`, `${total} operational event${total === 1 ? '' : 's'}`];
  for (const [field, label] of OPERATIONAL_EVENTS) {
    const count = Number(bucket?.[field] || 0);
    if (count !== 0) parts.push(`${label}: ${count}`);
  }
  if (bucket?.human_messages != null) parts.push(`Human messages: ${bucket.human_messages}`);
  if (bucket?.voice_member_minutes != null) parts.push(`Voice minutes: ${bucket.voice_member_minutes}`);
  return parts.join(' · ');
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

function isSubDayGranularity(granularity, selectedRange) {
  return granularity === 'hour' || granularity === '6hour'
    || (!granularity && (selectedRange === '1d' || selectedRange === '3d'));
}

function formatAxisTicks(series, indexes, { granularity, selectedRange, locale, timeZone }) {
  const isSubDay = isSubDayGranularity(granularity, selectedRange);
  const dates = indexes.map(index => new Date(series[index]?.period_start));
  const validDates = dates.filter(date => Number.isFinite(date.getTime()));
  const year = new Intl.DateTimeFormat(locale, { year: 'numeric', timeZone });
  const spansYears = validDates.length > 1 && year.format(validDates[0]) !== year.format(validDates.at(-1));
  const options = { month: 'short', day: 'numeric', timeZone };
  if (isSubDay) Object.assign(options, { hour: 'numeric', minute: '2-digit' });
  else if (spansYears) options.year = '2-digit';
  const formatter = new Intl.DateTimeFormat(locale, options);
  const zoned = new Intl.DateTimeFormat(locale, { ...options, timeZoneName: 'short' });
  const labels = dates.map(date => Number.isFinite(date.getTime()) ? formatter.format(date) : '');
  return labels.map((label, index) =>
    label && labels.indexOf(label) !== labels.lastIndexOf(label) ? zoned.format(dates[index]) : label);
}

function analyticsChartMarkup(projection, selectedRange, clock) {
  const series = Array.isArray(projection?.series) ? projection.series : [];
  if (!series.length) return '';

  const totals = series.map(activityTotal);
  const maximum = niceActivityMaximum(Math.max(0, ...totals));
  const width = 640;
  const height = 264;
  const margin = { top: 18, right: 20, bottom: 48, left: 54 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const xFor = index => series.length === 1
    ? margin.left + (plotWidth / 2)
    : margin.left + ((index / (series.length - 1)) * plotWidth);
  const pointStep = series.length > 1 ? plotWidth / (series.length - 1) : plotWidth;
  const hitRadius = Math.max(5, Math.min(10, Math.floor(((pointStep - 2) / 2) * 10) / 10));
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
  const tickIndexes = xTickIndexes(
    series.length,
    isSubDayGranularity(projection.bucket_granularity, selectedRange) ? 4 : 6,
  );
  const tickLabels = formatAxisTicks(series, tickIndexes, {
    granularity: projection.bucket_granularity, selectedRange, ...clock,
  });
  const summary = `${series.length} real bucket${series.length === 1 ? '' : 's'} plotted for ${selectedRange === 'all' ? 'All time' : selectedRange}. Activity ranges from ${Math.min(...totals)} to ${Math.max(...totals)} operational events per supplied bucket.`;

  return `
    <section class="analytics-chart-section" aria-labelledby="analytics-chart-title">
      <div class="analytics-section-heading"><h2 id="analytics-chart-title">Activity over time</h2></div>
      <figure class="analytics-chart">
        <div class="analytics-chart-scroll">
        <svg class="analytics-line-chart" viewBox="0 0 ${width} ${height}" role="group" aria-labelledby="analytics-chart-title" aria-describedby="analytics-line-chart-summary" preserveAspectRatio="xMidYMid meet">
          <desc id="analytics-line-chart-summary">${escapeHtml(summary)}</desc>
          <g class="analytics-axis analytics-axis-y" aria-hidden="true">
            <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}"></line>
            ${yTicks.map(tick => `<g class="analytics-axis-tick"><line x1="${margin.left - 5}" y1="${tick.y.toFixed(2)}" x2="${margin.left}" y2="${tick.y.toFixed(2)}"></line><text x="${margin.left - 9}" y="${(tick.y + 4).toFixed(2)}" text-anchor="end">${escapeHtml(tick.label)}</text></g>`).join('')}
            <text class="analytics-axis-label" x="14" y="${margin.top + (plotHeight / 2)}" text-anchor="middle" transform="rotate(-90 14 ${margin.top + (plotHeight / 2)})">Activity count</text>
          </g>
          <g class="analytics-axis analytics-axis-x" aria-hidden="true">
            <line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${margin.left + plotWidth}" y2="${margin.top + plotHeight}"></line>
            ${tickIndexes.map((index, tick) => {
    const x = xFor(index).toFixed(2);
    const first = series.length > 1 && index === 0 && tickLabels[tick].length > 12;
    const last = series.length > 1 && index === series.length - 1;
    const labelX = first ? 4 : last ? width - 4 : x;
    const anchor = first ? 'start' : last ? 'end' : 'middle';
    return `<g class="analytics-axis-tick"><line x1="${x}" y1="${margin.top + plotHeight}" x2="${x}" y2="${margin.top + plotHeight + 5}"></line><text x="${labelX}" y="${margin.top + plotHeight + 20}" text-anchor="${anchor}">${escapeHtml(tickLabels[tick])}</text></g>`;
  }).join('')}
            <text class="analytics-axis-label" x="${margin.left + (plotWidth / 2)}" y="${height - 6}" text-anchor="middle">Local time / date</text>
          </g>
          ${series.length > 1 ? `<polyline class="analytics-line-path" points="${points.join(' ')}" fill="none"></polyline>` : ''}
          ${series.map((bucket, index) => {
    const label = escapeHtml(bucketSummary(bucket, totals[index], clock));
    const position = `cx="${xFor(index).toFixed(2)}" cy="${yFor(totals[index]).toFixed(2)}"`;
    return `<g class="analytics-point-group" tabindex="0" role="button" data-analytics-point="${index}" data-bucket-summary="${label}" aria-label="${label}">
      <circle class="analytics-line-hit" ${position} r="${hitRadius}"></circle>
      <circle class="analytics-line-point" ${position} r="4"></circle>
    </g>`;
  }).join('')}
        </svg>
        </div>
        <div class="analytics-chart-inspector" data-analytics-inspector aria-live="polite">Select, focus, or hover a point to inspect bucket counts.</div>
        <figcaption>Activity count per supplied bucket from persisted server data.</figcaption>
      </figure>
    </section>`;
}


function analyticsReportMarkup(snapshot, requestedRange, clock) {
  const { selectedRange, projection } = rangeProjection(snapshot, requestedRange);
  if (!projection) {
    return `
      <p class="analytics-unavailable" role="status">
        Analytics data unavailable. Refresh server state to try again.
      </p>`;
  }

  const v2 = isAnalyticsV2(snapshot, projection);
  const coverage = v2 ? selectAnalyticsCoverage(snapshot, projection) : null;
  const { tickets_closed: ticketsClosed, tickets_closed_distinct: distinct } = projection;
  const closed = v2 && ticketsClosed != null && distinct != null && distinct !== ticketsClosed
    ? `${ticketsClosed} (${distinct} distinct)`
    : ticketsClosed ?? (v2 ? 'Unavailable' : 0);
  const backlog = snapshot.analytics.open_ticket_backlog ?? projection.open_ticket_backlog;

  return `
    <section class="control-feature-body" data-active-analytics-range="${escapeHtml(selectedRange)}">
      <div class="analytics-range-row">
        <section class="analytics-period" aria-label="Selected analytics range">
          <span><strong>From</strong> ${escapeHtml(formatLocalTimestamp(projection.period_start, clock))}</span>
          <span><strong>To</strong> ${escapeHtml(formatLocalTimestamp(projection.period_end, clock))}</span>
        </section>
        ${rangeControlsMarkup(snapshot, selectedRange)}
      </div>
      <dl class="control-stat-list" aria-label="Selected period operational metrics">
        ${metricDefinition('Moderation cases', projection.moderation_cases ?? 0)}
        ${metricDefinition('Tickets opened', projection.tickets_opened ?? 0)}
        ${metricDefinition('Tickets closed', closed)}
        ${v2 ? metricDefinition('Tickets reopened', projection.tickets_reopened ?? 0) : ''}
        ${v2 ? metricDefinition('Open tickets (current)', backlog ?? 'Unavailable') : ''}
        ${v2 ? metricDefinition('Median ticket close time', ticketsClosed == null ? 'Unavailable' : ticketsClosed === 0 ? 'No closures' : formatDurationSeconds(projection.ticket_median_close_seconds, { ticketsClosed })) : ''}
        ${metricDefinition('Quiz answers', projection.quiz_answers ?? 0)}
        ${metricDefinition('Quiz accuracy', formatAccuracy(projection.quiz_accuracy))}
        ${metricDefinition('Anonymous questions', projection.anonymous_questions ?? 0)}
        ${v2 ? metricDefinition('Anonymous messages', projection.anonymous_messages ?? 0) : ''}
        ${metricDefinition('Reputation events', projection.reputation_events ?? 0)}
      </dl>
      ${v2 ? passiveSectionMarkup(projection, coverage) : ''}
      ${analyticsChartMarkup(projection, selectedRange, clock)}
    </section>`;
}

function reportingActionsMarkup(state) {
  if (state.mode !== 'edit') return '';
  return `<div class="analytics-page-actions control-save-bar">${saveBarStatusMarkup(state)}<button class="control-button control-button-primary" type="button" data-analytics-save${state.dirty && state.status !== 'saving' ? '' : ' disabled'}>${state.status === 'saving' ? 'Saving…' : 'Save changes'}</button><button class="control-button control-button-secondary" type="button" data-analytics-discard${state.status === 'saving' ? ' disabled' : ''}>Discard</button></div>`;
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

    renderContext({ state, snapshot, locale, timeZone } = {}) {
      const report = resourceBindingState(snapshot || {}, 'analytics');
      const channel = (snapshot?.channels || []).find(item => String(item.id) === String(report.id || ''));
      const { projection } = rangeProjection(snapshot, selectedRange);
      let dataSource = 'Persisted moderation, ticket, quiz, anonymous, and reputation events';
      if (isAnalyticsV2(snapshot, projection)) {
        const coverage = selectAnalyticsCoverage(snapshot, projection);
        const available = PASSIVE_METRICS.filter(({ field, family }) =>
          hasPassiveCount(projection?.[field], coverage?.[family]?.status));
        dataSource = available.length
          ? `Persisted business events and passive telemetry (${available.map(({ label }) => label.toLowerCase()).join(', ')})`
          : 'Persisted business events. Passive telemetry unavailable.';
      }
      const rows = [
        { label: 'Send permission', value: channel?.send_messages === true ? 'Allowed' : 'Missing Send Messages or not a text channel' },
        { label: 'Data source', value: dataSource },
      ];
      const generatedAt = projection?.generated_at ?? snapshot?.analytics?.generated_at;
      if (generatedAt) {
        rows.push({ label: 'Last generated', value: formatLocalTimestamp(generatedAt, { locale, timeZone }) });
      }
      if (state?.mode !== 'edit') {
        rows.unshift({ label: 'Channel', value: `${report.name || report.current} (${report.label})` });
      }
      return contextSectionMarkup({
        id: 'report-destination',
        title: 'Report destination',
        description: 'Rob-bot posts the aggregate report to this channel on its configured schedule.',
        body: contextDefinitionListMarkup(rows),
      });
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
    registerControlPage(withResourceBindings(createAnalyticsPageDefinition(), featureResourceKeys(ANALYTICS_PAGE_KEY)));
  }
}

export function analyticsPageMarkup({ state, snapshot, selectedRange, locale, timeZone } = {}) {
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
      ${controlPageHeaderMarkup({
    title: 'Analytics',
    description: 'Operational activity from persisted server data.',
    enabled,
    editing: state.mode === 'edit',
    editAttribute: 'data-analytics-edit',
    toggleAttribute: 'data-analytics-enabled',
  })}
      ${statusMarkup}
      ${analyticsReportMarkup(snapshot, preferredRange, { locale, timeZone })}
      ${reportingActionsMarkup(state)}
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

  const pointForEvent = event => event.target?.closest?.('[data-analytics-point]');
  let activePoint = null;
  const activatePoint = point => {
    if (!point || point === activePoint) return;
    const inspector = root.querySelector('[data-analytics-inspector]');
    if (!inspector) return;
    inspector.textContent = point.getAttribute('data-bucket-summary');
    activePoint?.removeAttribute('data-active');
    point.setAttribute('data-active', 'true');
    activePoint = point;
  };
  const onPointEvent = event => activatePoint(pointForEvent(event));

  const onKeyDown = event => {
    const point = pointForEvent(event);
    if (!point) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Space') {
      event.preventDefault();
      activatePoint(point);
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const points = [...root.querySelectorAll('[data-analytics-point]')];
    const index = points.indexOf(point);
    const next = {
      ArrowLeft: Math.max(0, index - 1),
      ArrowRight: Math.min(points.length - 1, index + 1),
      Home: 0,
      End: points.length - 1,
    }[event.key];
    points[next]?.focus();
    activatePoint(points[next]);
  };

  const onClick = event => {
    const rangeButton = event.target?.closest?.('[data-analytics-range]');
    if (rangeButton && !rangeButton.disabled) {
      const value = rangeButton.getAttribute('data-analytics-range');
      if (RANGE_OPTIONS.some(option => option.key === value)) {
        onRangeChange(value);
        rerender();
        root.querySelector?.(`[data-analytics-range="${value}"]`)?.focus?.();
      }
      return;
    }

    const point = pointForEvent(event);
    if (point) {
      activatePoint(point);
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
  root.addEventListener('focusin', onPointEvent);
  root.addEventListener('pointerenter', onPointEvent, true);
  root.addEventListener('mouseover', onPointEvent);
  root.addEventListener('keydown', onKeyDown);
  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('change', onChange);
    root.removeEventListener('focusin', onPointEvent);
    root.removeEventListener('pointerenter', onPointEvent, true);
    root.removeEventListener('mouseover', onPointEvent);
    root.removeEventListener('keydown', onKeyDown);
  };
}
