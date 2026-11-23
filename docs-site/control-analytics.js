import {
  controlState,
  registerControlPage,
  registeredControlPage,
} from './control-page-registry.js';
import {
  controlPageHeaderMarkup,
  masterSwitchRow,
  settingRow,
  settingsRows,
  settingsSection,
  disclosure,
} from './control-components.js?v=28';
import { featureResourceKeys } from './control-resource-contract.js';
import { resourceSelectMarkup, withResourceBindings } from './control-resource-bindings.js?v=6';
import { problemsFromSnapshot } from './control-problems.js?v=2';
import { animateSegmentedThumbs, segmentedControlMarkup, stagedSaveBarMarkup } from './control-page-parts.js';

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

const RANGE_PHRASES = Object.freeze({
  '1d': 'in the last 24 hours',
  '3d': 'in the last 3 days',
  '7d': 'in the last 7 days',
  '2w': 'in the last 2 weeks',
  '1m': 'in the last month',
  all: 'across all time',
});
const GRANULARITY_NOUNS = Object.freeze({ hour: 'hour', '6hour': '6 hours', day: 'day', week: 'week' });

function formatAccuracy(value) {
  return value == null ? 'No answers' : `${Math.round(Number(value) * 100)}%`;
}

function factRow(label, value) {
  return `<div class="control-stat-row"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function coverageDetail(entry) {
  if (entry.note != null) return String(entry.note);
  if (entry.status === 'complete' && !entry.gap_count && !entry.dropped_events) return '';
  const parts = [`${Math.round(Number(entry.covered_ratio || 0) * 100)}% covered`];
  if (entry.gap_count > 0) parts.push(`${entry.gap_count} ${entry.gap_count === 1 ? 'gap' : 'gaps'}`);
  if (entry.dropped_events > 0) parts.push(`${entry.dropped_events} dropped`);
  return parts.join(' · ');
}

// One sentence, only when some family is not complete. Healthy coverage says nothing.
export function coverageSentence(coverage) {
  if (!coverage) return '';
  const parts = [];
  for (const [family, label] of COVERAGE_FAMILIES) {
    const entry = coverage[family];
    if (!entry || entry.status === 'complete') continue;
    // Passive telemetry that is switched off is expected, not missing data; its rows are already omitted.
    if (family !== 'business_events' && entry.status === 'unavailable') continue;
    const word = entry.status === 'partial' ? 'partial' : 'unavailable';
    const detail = coverageDetail(entry);
    parts.push(`${label} ${word}${detail ? ` (${detail})` : ''}`);
  }
  return parts.length ? `Some data is incomplete: ${parts.join('; ')}.` : '';
}

function hasPassiveCount(value, status) {
  return value != null && (status === 'complete' || status === 'partial');
}

export function rangeProjection(snapshot, requestedRange) {
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

function rangeControlMarkup(snapshot, selectedRange) {
  const ranges = snapshot?.analytics?.ranges || {};
  return segmentedControlMarkup({
    id: 'analytics-range',
    label: 'Analytics period',
    selected: selectedRange,
    options: RANGE_OPTIONS.map(option => ({
      key: option.key,
      label: option.label,
      disabled: !ranges[option.key],
      attributes: `data-analytics-range="${option.key}"`,
    })),
  });
}

export function activityTotal(bucket) {
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

// Integer ticks on 1, 2, 5 steps. Always at least two steps, at most five, and the top is at or above the maximum.
export function niceTicks(maximum) {
  const max = Math.max(0, Math.ceil(Number(maximum) || 0));
  let step = 1;
  for (let power = 1; Math.ceil(max / step) > 5; ) {
    for (const factor of [1, 2, 5]) {
      step = factor * power;
      if (Math.ceil(max / step) <= 5) break;
    }
    power *= 10;
  }
  const intervals = Math.max(2, Math.ceil(max / step));
  return Array.from({ length: intervals + 1 }, (_, index) => index * step);
}

const LABEL_GAP = 10;
const labelWidth = text => (String(text).length * 6.6) + 4;

// Which x labels show. Every label when they fit; otherwise an even step, always keeping the first and last.
export function planAxisLabels(labels, slotWidth) {
  const count = labels.length;
  if (!count) return { indexes: [], step: 1 };
  const widest = Math.max(...labels.map(labelWidth));
  const step = Math.max(1, Math.ceil((widest + LABEL_GAP) / slotWidth));
  const indexes = [];
  for (let index = 0; index < count; index += step) indexes.push(index);
  const last = count - 1;
  if (indexes.at(-1) !== last) {
    if (indexes.length > 1 && (last - indexes.at(-1)) * slotWidth < widest + LABEL_GAP) indexes.pop();
    indexes.push(last);
  }
  return { indexes, step };
}

function isSubDayGranularity(granularity, selectedRange) {
  return granularity === 'hour' || granularity === '6hour'
    || (!granularity && (selectedRange === '1d' || selectedRange === '3d'));
}

function bucketLabels(series, { granularity, selectedRange, locale, timeZone }) {
  const dates = series.map(bucket => new Date(bucket?.period_start));
  const valid = dates.filter(date => Number.isFinite(date.getTime()));
  const year = new Intl.DateTimeFormat(locale, { year: 'numeric', timeZone });
  const spansYears = valid.length > 1 && year.format(valid[0]) !== year.format(valid.at(-1));
  const options = { timeZone };
  if (granularity === 'hour' || (!granularity && selectedRange === '1d')) Object.assign(options, { hour: 'numeric' });
  else if (isSubDayGranularity(granularity, selectedRange)) Object.assign(options, { month: 'short', day: 'numeric', hour: 'numeric' });
  else Object.assign(options, { month: 'short', day: 'numeric' }, spansYears ? { year: '2-digit' } : {});
  const formatter = new Intl.DateTimeFormat(locale, options);
  const zoned = new Intl.DateTimeFormat(locale, { ...options, timeZoneName: 'short' });
  const labels = dates.map(date => Number.isFinite(date.getTime()) ? formatter.format(date) : '');
  return labels.map((label, index) =>
    label && labels.indexOf(label) !== labels.lastIndexOf(label) ? zoned.format(dates[index]) : label);
}

function tooltipTitle(bucket, { granularity, selectedRange, locale, timeZone }) {
  const date = new Date(bucket?.period_start);
  if (!Number.isFinite(date.getTime())) return '';
  const subDay = isSubDayGranularity(granularity, selectedRange);
  const options = subDay
    ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone }
    : { weekday: 'short', month: 'short', day: 'numeric', timeZone };
  const text = new Intl.DateTimeFormat(locale, options).format(date);
  return granularity === 'week' ? `Week of ${text}` : text;
}

function bucketDetail(bucket) {
  const parts = [];
  for (const [field, label] of OPERATIONAL_EVENTS) {
    const count = Number(bucket?.[field] || 0);
    if (count !== 0) parts.push(`${label} ${count}`);
  }
  return parts.join(' · ');
}

const eventsWord = count => `${count} event${count === 1 ? '' : 's'}`;

// Sized to the 960px page so SVG text renders at its stated 12px instead of scaling up.
const CHART = Object.freeze({ width: 920, height: 240, top: 12, right: 16, bottom: 30, left: 34 });

function analyticsChartMarkup(projection, selectedRange, clock) {
  const series = Array.isArray(projection?.series) ? projection.series : [];
  if (!series.length) return '';
  const { width, height, top, right, bottom, left } = CHART;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const baseline = top + plotHeight;
  const totals = series.map(activityTotal);
  const ticks = niceTicks(Math.max(0, ...totals));
  const axisMax = ticks.at(-1);
  const slot = plotWidth / series.length;
  const xFor = index => left + ((index + 0.5) * slot);
  const yFor = total => baseline - ((total / axisMax) * plotHeight);
  const granularity = projection.bucket_granularity;
  const context = { granularity, selectedRange, ...clock };
  const labels = bucketLabels(series, context);
  const plan = planAxisLabels(labels, slot);
  const noun = GRANULARITY_NOUNS[granularity] || 'bucket';
  const points = totals.map((total, index) => `${xFor(index).toFixed(2)},${yFor(total).toFixed(2)}`);
  const area = series.length > 1
    ? `<path class="analytics-area" d="M ${xFor(0).toFixed(2)},${baseline} L ${points.join(' L ')} L ${xFor(series.length - 1).toFixed(2)},${baseline} Z"></path>`
    : '';
  const peakIndex = totals.indexOf(Math.max(...totals));
  const summary = `${series.length} ${series.length === 1 ? noun : `${noun}s`} plotted. Activity ranges from ${Math.min(...totals)} to ${Math.max(...totals)} events per ${noun}${Math.max(...totals) > 0 ? `, highest on ${labels[peakIndex]}` : ''}.`;
  const valuesList = series.map((_, index) => `${labels[index]}: ${totals[index]}`).join(', ');
  const zone = new Intl.DateTimeFormat(clock.locale, { timeZone: clock.timeZone }).resolvedOptions().timeZone;
  const targets = series.map((bucket, index) => {
    const title = tooltipTitle(bucket, context);
    const detail = bucketDetail(bucket);
    return `<rect class="analytics-hit" x="${(left + (index * slot)).toFixed(2)}" y="${top}" width="${slot.toFixed(2)}" height="${plotHeight}" tabindex="${index === 0 ? 0 : -1}" role="img" data-analytics-point="${index}" data-x="${(xFor(index) / width * 100).toFixed(2)}" data-y="${(yFor(totals[index]) / height * 100).toFixed(2)}" data-cx="${xFor(index).toFixed(2)}" data-cy="${yFor(totals[index]).toFixed(2)}" data-title="${escapeHtml(title)}" data-total="${totals[index]}" data-detail="${escapeHtml(detail)}" data-bucket-summary="${escapeHtml(bucketSummary(bucket, totals[index], clock))}" aria-label="${escapeHtml(bucketSummary(bucket, totals[index], clock))}"></rect>`;
  }).join('');

  return `
    <figure class="analytics-chart">
      <div class="analytics-chart-scroll">
        <div class="analytics-plot" data-analytics-plot>
          <svg class="analytics-line-chart" viewBox="0 0 ${width} ${height}" role="group" aria-label="${escapeHtml(`Activity events per ${noun}: ${valuesList}`)}" aria-describedby="analytics-line-chart-summary" preserveAspectRatio="xMidYMid meet">
            <desc id="analytics-line-chart-summary">${escapeHtml(summary)}</desc>
            <g class="analytics-axis analytics-axis-y" aria-hidden="true">
              ${ticks.map(value => `<g class="analytics-axis-tick" data-tick="${value}"><line class="${value === 0 ? 'analytics-baseline' : 'analytics-gridline'}" x1="${left}" y1="${yFor(value).toFixed(2)}" x2="${left + plotWidth}" y2="${yFor(value).toFixed(2)}"></line><text x="${left - 8}" y="${(yFor(value) + 4).toFixed(2)}" text-anchor="end">${value}</text></g>`).join('')}
            </g>
            <g class="analytics-axis analytics-axis-x" aria-hidden="true">
              ${plan.indexes.map(index => `<text class="analytics-axis-tick" x="${xFor(index).toFixed(2)}" y="${baseline + 20}" text-anchor="middle">${escapeHtml(labels[index])}</text>`).join('')}
            </g>
            ${area}
            ${series.length > 1 ? `<polyline class="analytics-line-path" points="${points.join(' ')}" fill="none"></polyline>` : ''}
            ${totals.map((total, index) => `<circle class="analytics-line-point" cx="${xFor(index).toFixed(2)}" cy="${yFor(total).toFixed(2)}" r="3"></circle>`).join('')}
            <line class="analytics-guide" data-analytics-guide x1="0" y1="${top}" x2="0" y2="${baseline}" hidden></line>
            <circle class="analytics-guide-dot" data-analytics-guide-dot cx="0" cy="0" r="5" hidden></circle>
            ${targets}
          </svg>
          <div class="analytics-tooltip" data-analytics-tooltip aria-hidden="true" hidden></div>
        </div>
      </div>
      ${plan.step > 1 ? `<figcaption>Labels show every ${plan.step === 2 ? `other ${noun}` : `${plan.step} ${noun}s`}; hover or focus any ${noun} for its count.</figcaption>` : ''}
    </figure>`;
}

function breakdownTableMarkup(projection, selectedRange, clock) {
  const series = Array.isArray(projection?.series) ? projection.series : [];
  if (!series.length) return '';
  const granularity = projection.bucket_granularity;
  const context = { granularity, selectedRange, ...clock };
  const labels = bucketLabels(series, context);
  const columns = OPERATIONAL_EVENTS.filter(([field]) => series.some(bucket => Number(bucket?.[field] || 0) !== 0));
  const noun = GRANULARITY_NOUNS[granularity] || 'day';
  const table = `<div class="analytics-table-wrap"><table class="analytics-breakdown-table">
    <thead><tr><th scope="col">${escapeHtml(noun[0].toUpperCase() + noun.slice(1))}</th><th scope="col">Events</th>${columns.map(([, label]) => `<th scope="col">${escapeHtml(label)}</th>`).join('')}</tr></thead>
    <tbody>${series.map((bucket, index) => `<tr><th scope="row">${escapeHtml(labels[index])}</th><td>${activityTotal(bucket)}</td>${columns.map(([field]) => `<td>${Number(bucket?.[field] || 0)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
  return disclosure({ id: 'analytics-breakdown', label: `Breakdown by ${noun}`, body: table });
}

function factsMarkup(snapshot, projection, v2, coverage) {
  const { tickets_closed: ticketsClosed, tickets_closed_distinct: distinct } = projection;
  const closed = v2 && ticketsClosed != null && distinct != null && distinct !== ticketsClosed
    ? `${ticketsClosed} (${distinct} distinct)`
    : ticketsClosed ?? (v2 ? 'Unavailable' : 0);
  const backlog = snapshot.analytics.open_ticket_backlog ?? projection.open_ticket_backlog;
  const rows = [
    factRow('Moderation cases', projection.moderation_cases ?? 0),
    factRow('Tickets opened', projection.tickets_opened ?? 0),
    factRow('Tickets closed', closed),
    v2 ? factRow('Tickets reopened', projection.tickets_reopened ?? 0) : '',
    v2 ? factRow('Open tickets now', backlog ?? 'Unavailable') : '',
    v2 ? factRow('Median time to close', ticketsClosed == null ? 'Unavailable' : ticketsClosed === 0 ? 'No closures' : formatDurationSeconds(projection.ticket_median_close_seconds, { ticketsClosed })) : '',
    factRow('Quiz answers', projection.quiz_answers ?? 0),
    factRow('Quiz accuracy', formatAccuracy(projection.quiz_accuracy)),
    factRow('Anonymous questions', projection.anonymous_questions ?? 0),
    v2 ? factRow('Anonymous messages', projection.anonymous_messages ?? 0) : '',
    factRow('Reputation events', projection.reputation_events ?? 0),
  ];
  if (v2) {
    for (const { field, family, label, unit } of PASSIVE_METRICS) {
      const status = coverage?.[family]?.status;
      if (!hasPassiveCount(projection[field], status)) continue;
      rows.push(factRow(label, `${projection[field]}${unit}${status === 'partial' ? ' (partial)' : ''}`));
    }
  }
  return `<dl class="control-stat-list analytics-facts" aria-label="Totals for the selected period">${rows.join('')}</dl>`;
}

function updatedLabel(projection, snapshot, clock) {
  const value = projection?.generated_at ?? snapshot?.analytics?.generated_at;
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return '';
  return `Updated ${new Intl.DateTimeFormat(clock.locale, { hour: 'numeric', minute: '2-digit', timeZone: clock.timeZone }).format(date)}`;
}

function reportSection(state, snapshot) {
  const value = state.draft ?? state.persisted;
  const persistedBinding = state.persisted?.resourceBindings?.analytics ?? null;
  const selected = value?.resourceBindings?.analytics ?? null;
  const found = problemsFromSnapshot(snapshot).find(item => item.resourceKey === 'analytics');
  const sentence = found && String(persistedBinding ?? '') === String(selected ?? '') ? `${found.cause} ${found.effect}` : '';
  const text = sentence || state.errors?.resource_analytics || '';
  const rows = masterSwitchRow({
    label: 'Post the weekly report',
    offHint: 'Rob-bot stops posting the weekly report.',
    checked: Boolean(value?.enabled),
    field: 'enabled',
    attribute: 'data-analytics-enabled',
  }) + settingRow({
    label: 'Posts to',
    problem: text,
    rowKey: 'analytics',
    controlId: 'resource-analytics',
    control: resourceSelectMarkup({ snapshot, key: 'analytics', value: selected, problem: Boolean(text), id: 'resource-analytics' }),
  });
  return `<div data-master="${value?.enabled ? 'on' : 'off'}">${settingsSection({
    id: 'analytics-report-heading',
    title: 'Weekly report',
    body: settingsRows(rows, { label: 'Weekly report settings' }),
  })}</div>`;
}

function analyticsReportMarkup(snapshot, requestedRange, clock) {
  const { selectedRange, projection } = rangeProjection(snapshot, requestedRange);
  if (!projection) {
    return '<p class="analytics-unavailable" role="status">Analytics data unavailable. Refresh server state to try again.</p>';
  }
  const v2 = isAnalyticsV2(snapshot, projection);
  const coverage = v2 ? selectAnalyticsCoverage(snapshot, projection) : null;
  const total = activityTotal(projection);
  const updated = updatedLabel(projection, snapshot, clock);
  const sentence = coverageSentence(coverage);
  return `
    <section class="analytics-report" data-active-analytics-range="${escapeHtml(selectedRange)}">
      <p class="analytics-lead"><span class="analytics-lead-total" data-analytics-total>${total}</span><span class="analytics-lead-label">events ${RANGE_PHRASES[selectedRange] || ''}</span>${updated ? `<span class="analytics-lead-updated">${escapeHtml(updated)}</span>` : ''}</p>
      ${analyticsChartMarkup(projection, selectedRange, clock)}
      ${sentence ? `<p class="analytics-coverage" data-analytics-coverage>${escapeHtml(sentence)}</p>` : ''}
      ${breakdownTableMarkup(projection, selectedRange, clock)}
      ${factsMarkup(snapshot, projection, v2, coverage)}
    </section>`;
}

export function createAnalyticsPageDefinition() {
  let selectedRange = '7d';
  return {
    pageKey: ANALYTICS_PAGE_KEY,
    editOnMount: true,

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

    // The weekly report destination lives in the page; nothing moves to a context panel.
    renderContext() {
      return '';
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
    registerControlPage(withResourceBindings(createAnalyticsPageDefinition(), featureResourceKeys(ANALYTICS_PAGE_KEY), { genericContext: 'never' }));
  }
}

export function analyticsPageMarkup({ state, snapshot, selectedRange, locale, timeZone } = {}) {
  if (!state?.persisted) {
    return '<section class="control-page analytics-page"><h1>Analytics</h1><p>Load current server state to view the operational snapshot.</p></section>';
  }
  const statusMarkup = state.saveError
    ? `<p class="analytics-page-message" role="alert">${escapeHtml(state.saveError)}</p>`
    : state.status === 'conflict'
      ? '<p class="analytics-page-message" role="alert">Server state changed while you were editing. Review your draft before retrying.</p>'
      : '';
  const preferredRange = selectedRange || String(snapshot?.analytics?.default_range || '7d');
  const { selectedRange: shownRange } = rangeProjection(snapshot, preferredRange);
  return `
    <section class="control-page analytics-page" data-page-key="${ANALYTICS_PAGE_KEY}">
      ${controlPageHeaderMarkup({
    title: 'Analytics',
    editable: false,
    actions: snapshot?.analytics ? rangeControlMarkup(snapshot, shownRange) : '',
  })}
      ${statusMarkup}
      ${analyticsReportMarkup(snapshot, preferredRange, { locale, timeZone })}
      ${reportSection(state, snapshot || {})}
      ${stagedSaveBarMarkup(state, { saveAttribute: 'data-analytics-save', discardAttribute: 'data-analytics-discard' })}
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
  animateSegmentedThumbs(root);

  const pointForEvent = event => event.target?.closest?.('[data-analytics-point]');
  let activePoint = null;
  const hideTooltip = () => {
    root.querySelector('[data-analytics-tooltip]')?.setAttribute('hidden', '');
    root.querySelector('[data-analytics-guide]')?.setAttribute('hidden', '');
    root.querySelector('[data-analytics-guide-dot]')?.setAttribute('hidden', '');
    activePoint?.removeAttribute('data-active');
    activePoint = null;
  };
  const activatePoint = point => {
    if (!point || point === activePoint) return;
    const tooltip = root.querySelector('[data-analytics-tooltip]');
    if (!tooltip) return;
    activePoint?.removeAttribute('data-active');
    point.setAttribute('data-active', 'true');
    activePoint = point;
    const total = Number(point.getAttribute('data-total'));
    const detail = point.getAttribute('data-detail');
    tooltip.innerHTML = `<strong>${escapeHtml(point.getAttribute('data-title'))}</strong><span>${eventsWord(total)}</span>${detail ? `<small>${escapeHtml(detail)}</small>` : ''}`;
    tooltip.style?.setProperty?.('--tip-x', `${point.getAttribute('data-x')}%`);
    tooltip.style?.setProperty?.('--tip-y', `${point.getAttribute('data-y')}%`);
    tooltip.removeAttribute('hidden');
    const cx = point.getAttribute('data-cx');
    const guide = root.querySelector('[data-analytics-guide]');
    guide?.setAttribute('x1', cx);
    guide?.setAttribute('x2', cx);
    guide?.removeAttribute('hidden');
    const dot = root.querySelector('[data-analytics-guide-dot]');
    dot?.setAttribute('cx', cx);
    dot?.setAttribute('cy', point.getAttribute('data-cy'));
    dot?.removeAttribute('hidden');
  };
  const onPointEvent = event => activatePoint(pointForEvent(event));
  const onLeave = event => {
    if (event.target?.closest?.('[data-analytics-plot]') && !root.querySelector?.('[data-analytics-point]:focus')) hideTooltip();
  };

  const onKeyDown = event => {
    const point = pointForEvent(event);
    if (!point) return;
    if (event.key === 'Escape') { hideTooltip(); return; }
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
    points.forEach((item, position) => item.setAttribute('tabindex', position === next ? '0' : '-1'));
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
    if (event.target?.closest?.('[data-analytics-save]')) {
      if (store.canSave(ANALYTICS_PAGE_KEY)) onSave?.(ANALYTICS_PAGE_KEY, store.buildSaveRequest(ANALYTICS_PAGE_KEY));
      return;
    }
    if (event.target?.closest?.('[data-analytics-discard]')) {
      store.discard(ANALYTICS_PAGE_KEY);
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
  root.addEventListener('mouseout', onLeave);
  root.addEventListener('keydown', onKeyDown);
  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('change', onChange);
    root.removeEventListener('focusin', onPointEvent);
    root.removeEventListener('pointerenter', onPointEvent, true);
    root.removeEventListener('mouseover', onPointEvent);
    root.removeEventListener('mouseout', onLeave);
    root.removeEventListener('keydown', onKeyDown);
  };
}
