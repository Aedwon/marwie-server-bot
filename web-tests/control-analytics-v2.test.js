import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import * as analyticsUI from '../docs-site/control-analytics.js';

const state = { mode: 'edit', status: 'clean', persisted: { enabled: true, resourceBindings: { analytics: '250' } }, draft: { enabled: true, resourceBindings: { analytics: '250' } } };
const manila = { locale: 'en-US', timeZone: 'Asia/Manila' };
const generatedAt = '2026-11-20T07:15:49Z';
const complete = { status: 'complete', covered_ratio: 1, gap_count: 0, dropped_events: 0 };
const disabled = { status: 'unavailable', covered_ratio: 0, gap_count: 1, dropped_events: 3, note: 'Passive telemetry disabled' };
const hour = 60 * 60 * 1000;
const dayStart = Date.parse('2026-11-19T07:00:00Z');

function hourlyBucket(index) {
  return {
    period_start: new Date(dayStart + index * hour).toISOString(),
    period_end: new Date(dayStart + (index + 1) * hour).toISOString(),
  };
}

const legacyMetrics = {
  moderation_cases: 1,
  tickets_opened: 2,
  tickets_closed: 4,
  quiz_answers: 0,
  quiz_accuracy: null,
  anonymous_questions: 5,
  reputation_events: 6,
};

function v2Snapshot(overrides = {}) {
  const oneDay = {
    ...legacyMetrics,
    range_key: '1d',
    bucket_granularity: 'hour',
    period_start: hourlyBucket(0).period_start,
    period_end: hourlyBucket(23).period_end,
    series: Array.from({ length: 24 }, (_, index) => hourlyBucket(index)),
    open_ticket_backlog: 8,
    tickets_closed_distinct: 3,
    tickets_reopened: 2,
    ticket_median_close_seconds: 185,
    anonymous_messages: 9,
    human_messages: null,
    voice_member_minutes: null,
    coverage: { business_events: complete, messages: disabled, voice: disabled },
    ...overrides,
  };
  const defaultCoverage = { business_events: complete, messages: disabled, voice: disabled };
  return {
    analytics: {
      schema_version: 2,
      default_range: '7d',
      generated_at: generatedAt,
      coverage: defaultCoverage,
      ranges: {
        '1d': oneDay,
        '7d': {
          ...oneDay,
          range_key: '7d',
          bucket_granularity: 'day',
          period_start: '2026-11-13T07:00:00Z',
          series: [],
          open_ticket_backlog: 8,
          tickets_closed: 3,
          tickets_closed_distinct: 3,
          coverage: defaultCoverage,
        },
        '1m': { ...legacyMetrics, range_key: '1m', bucket_granularity: 'day' },
      },
    },
  };
}

function page(snapshot, selectedRange = '1d', clock = manila) {
  return analyticsUI.analyticsPageMarkup({ state, snapshot, selectedRange, ...clock });
}

function metric(markup, label) {
  const start = markup.indexOf('<dt>' + label + '</dt>');
  assert.notEqual(start, -1, label);
  return markup.slice(start).match(/<dd>([^<]*)<\/dd>/)?.[1];
}

test('formats ticket close durations and distinguishes no closures from missing data', () => {
  for (const [seconds, expected] of [[0, '0s'], [45, '45s'], [185, '3m 5s'], [5400, '1h 30m'], [90000, '1d 1h']]) {
    assert.equal(analyticsUI.formatDurationSeconds(seconds), expected);
  }
  assert.equal(analyticsUI.formatDurationSeconds(null, { ticketsClosed: 0 }), 'No closures');
  assert.equal(analyticsUI.formatDurationSeconds(null, { ticketsClosed: 3 }), 'Unavailable');
  assert.equal(analyticsUI.formatDurationSeconds(null), 'Unavailable');
  assert.equal(analyticsUI.formatDurationSeconds(Infinity), 'Unavailable');
});

test('detects versioned and unversioned v2 data without treating v1 as v2', () => {
  assert.equal(analyticsUI.isAnalyticsV2(v2Snapshot(), {}), true);
  assert.equal(analyticsUI.isAnalyticsV2({}, { human_messages: null }), true);
  assert.equal(analyticsUI.isAnalyticsV2({}, { coverage: {} }), true);
  assert.equal(analyticsUI.isAnalyticsV2({ analytics: legacyMetrics }, legacyMetrics), false);
});

test('uses selected coverage and only falls back for the default range or a flat snapshot', () => {
  const selectedCoverage = { messages: complete };
  const snapshot = v2Snapshot({ coverage: selectedCoverage });
  const { analytics } = snapshot;
  assert.equal(analyticsUI.selectAnalyticsCoverage(snapshot, analytics.ranges['1d']), selectedCoverage);
  assert.equal(analyticsUI.selectAnalyticsCoverage(snapshot, analytics.ranges['1m']), null);
  assert.equal(analyticsUI.selectAnalyticsCoverage(snapshot, { range_key: '7d' }), analytics.coverage);
  assert.equal(analyticsUI.selectAnalyticsCoverage({ analytics: { coverage: analytics.coverage } }, {}), analytics.coverage);
  assert.doesNotMatch(page(snapshot, '1m'), /data-analytics-coverage|Passive telemetry disabled/);
});


test('formats timestamps in the supplied local timezone and shows the update time on the lead line', () => {
  const local = analyticsUI.formatLocalTimestamp(generatedAt, manila);
  assert.match(local, /3:15 PM/);
  assert.doesNotMatch(local, /\bUTC\b/);
  assert.match(page(v2Snapshot()), /<span class="analytics-lead-updated">Updated 3:15 PM<\/span>/);
  assert.doesNotMatch(page(v2Snapshot()), /<strong>From<\/strong>/);
});

test('lead total is the eight-field v2 sum for the selected range and follows the range label', () => {
  const day = page(v2Snapshot(), '1d');
  const expected = 1 + 2 + 4 + 2 + 0 + 5 + 9 + 6;
  assert.match(day, new RegExp(`data-analytics-total>${expected}</span><span class="analytics-lead-label">events in the last 24 hours</span>`));
  assert.match(page(v2Snapshot(), '7d'), /events in the last 7 days/);
  assert.match(page(v2Snapshot(), '1m'), /events in the last month/);
  assert.equal(analyticsUI.activityTotal({ quiz_correct: 99, human_messages: 50, moderation_cases: 1 }), 1);
});

test('breakdown uses the ticket semantics and labels, and renders no chips or dotted markup', () => {
  const snapshot = v2Snapshot();
  const day = page(snapshot);
  const week = page(snapshot, '7d');
  assert.equal(metric(day, 'Open tickets now'), '8');
  assert.equal(metric(week, 'Open tickets now'), '8');
  assert.equal(metric(day, 'Tickets closed'), '4 (3 distinct)');
  assert.equal(metric(week, 'Tickets closed'), '3');
  assert.equal(metric(day, 'Tickets reopened'), '2');
  assert.equal(metric(day, 'Anonymous messages'), '9');
  assert.equal(metric(day, 'Median time to close'), '3m 5s');
  assert.doesNotMatch(day, /control-state-chip|control-context-status|analytics-coverage-status|Edit settings|data-control-details/);
  assert.doesNotMatch(day, /Open tickets \(current\)|Median ticket close time/);
});

test('distinguishes no quiz answers from zero accuracy', () => {
  assert.equal(metric(page(v2Snapshot()), 'Quiz accuracy'), 'No answers');
  const markup = page(v2Snapshot({ quiz_answers: 4, quiz_correct: 0, quiz_accuracy: 0 }));
  assert.equal(metric(markup, 'Quiz accuracy'), '0%');
});

test('passive rows are omitted when unavailable and a disabled counter never reads 0', () => {
  const note = 'Passive telemetry disabled (1 gap, 3 dropped)';
  const markup = page(v2Snapshot({
    human_messages: 0,
    coverage: { business_events: complete, messages: { ...disabled, note }, voice: disabled },
  }));
  assert.doesNotMatch(markup, /<dt>Human messages<\/dt>|<dt>Voice member minutes<\/dt>/);
  // Telemetry that is switched off is expected: no rows and no incomplete-data sentence.
  assert.doesNotMatch(markup, /Some data is incomplete|3 dropped/);
});

test('partial passive values show with a partial marker and the coverage sentence names the gap', () => {
  const markup = page(v2Snapshot({
    human_messages: 42,
    coverage: {
      business_events: complete,
      messages: { ...complete, status: 'partial', dropped_events: 3 },
      voice: disabled,
    },
  }));
  assert.equal(metric(markup, 'Human messages'), '42 (partial)');
  assert.doesNotMatch(markup, /<dt>Voice member minutes<\/dt>/);
  assert.match(markup, /Messages partial \(100% covered · 3 dropped\)/);
});

test('measured passive zeros render, and complete coverage adds no sentence', () => {
  const markup = page(v2Snapshot({
    human_messages: 0,
    voice_member_minutes: 0,
    coverage: { business_events: complete, messages: complete, voice: complete },
  }));
  assert.equal(metric(markup, 'Human messages'), '0');
  assert.equal(metric(markup, 'Voice member minutes'), '0 min');
  assert.doesNotMatch(markup, /data-analytics-coverage|incomplete|\(partial\)/);

  const partial = page(v2Snapshot({
    voice_member_minutes: 12.5,
    coverage: { business_events: complete, messages: complete, voice: { ...complete, status: 'partial' } },
  }));
  assert.doesNotMatch(partial, /<dt>Human messages<\/dt>/);
  assert.equal(metric(partial, 'Voice member minutes'), '12.5 min (partial)');
  assert.equal((partial.match(/data-analytics-coverage/g) || []).length, 1);
  assert.equal(analyticsUI.coverageSentence(null), '');
  // Passive telemetry switched off is expected and produces no warning sentence.
  const off = { status: 'unavailable', note: 'Passive telemetry disabled' };
  assert.equal(analyticsUI.coverageSentence({ business_events: complete, messages: off, voice: off }), '');
  assert.match(analyticsUI.coverageSentence({ business_events: { ...complete, status: 'partial', covered_ratio: 0.5 }, messages: off, voice: off }), /^Some data is incomplete: Business events partial/);
});

test('legacy v1 data keeps seven fact rows and only charts supplied ranged buckets', () => {
  const flat = page({ analytics: legacyMetrics });
  assert.equal((flat.match(/class="control-stat-row"/g) || []).length, 7);
  assert.doesNotMatch(flat, /<svg class="analytics-line-chart|data-analytics-coverage/);
  const projection = { ...legacyMetrics, series: [hourlyBucket(0), hourlyBucket(1)] };
  const ranged = page({ analytics: { default_range: '1d', ranges: { '1d': projection } } });
  assert.equal((ranged.match(/class="control-stat-row"/g) || []).length, 7);
  assert.equal((ranged.match(/data-analytics-range=/g) || []).length, 6);
  assert.equal((ranged.match(/data-analytics-point=/g) || []).length, 2);
});

test('the range control is a segmented control with a sliding thumb and the existing keys', () => {
  const markup = page(v2Snapshot(), '1d');
  assert.match(markup, /<div class="control-segn" data-segn="analytics-range" role="group" aria-label="Analytics period" data-count="6"/);
  assert.match(markup, /<span class="control-segn-thumb" aria-hidden="true"><\/span>/);
  assert.deepEqual([...markup.matchAll(/data-analytics-range="([^"]+)">([^<]+)</g)].map(m => [m[1], m[2]]), [
    ['1d', '1d'], ['3d', '3d'], ['7d', '7d'], ['2w', '2w'], ['1m', '1m'], ['all', 'All time'],
  ]);
  assert.match(markup, /aria-pressed="true" data-analytics-range="1d"/);
  assert.match(markup, /data-analytics-range="all" disabled|aria-pressed="false" disabled data-analytics-range="all"/);
});

test('Analytics has no context panel and keeps the weekly report as settings rows', () => {
  const definition = analyticsUI.createAnalyticsPageDefinition();
  assert.equal(definition.editOnMount, true);
  assert.equal(definition.renderContext({ state, snapshot: v2Snapshot() }), '');
  const markup = page(v2Snapshot());
  assert.match(markup, /Post the weekly report/);
  assert.match(markup, /<label class="control-setting-label" for="resource-analytics">Posts to<\/label>/);
  assert.match(markup, /data-analytics-enabled/);
  assert.match(markup, /<select class="control-select" id="resource-analytics" data-resource-select="analytics"/);
  assert.match(markup, /class="control-save-bar"/);
});

function chartPage(range, bucketGranularity, series, clock = manila) {
  const snapshot = v2Snapshot();
  snapshot.analytics.ranges[range] = {
    range_key: range,
    bucket_granularity: bucketGranularity,
    series,
  };
  return page(snapshot, range, clock);
}

function xTickLabels(markup) {
  const axis = /<g class="analytics-axis analytics-axis-x"[^>]*>([\s\S]*?)<\/g>/.exec(markup);
  assert.ok(axis, 'expected an x-axis group');
  return [...axis[1].matchAll(/<text class="analytics-axis-tick" x="([\d.]+)"[^>]*>([^<]*)<\/text>/g)].map(m => ({ x: Number(m[1]), label: m[2] }));
}

function yTicks(markup) {
  return [...markup.matchAll(/data-tick="(\d+)"/g)].map(m => Number(m[1]));
}

const operationalBucket = {
  ...hourlyBucket(0),
  moderation_cases: 1,
  tickets_opened: 2,
  tickets_closed: 3,
  tickets_reopened: 4,
  quiz_answers: 5,
  quiz_correct: 4,
  anonymous_questions: 6,
  anonymous_messages: 7,
  reputation_events: 8,
  human_messages: 0,
  voice_member_minutes: 12.5,
};

test('v2 chart counts all eight operational event types and excludes correct answers and passive counts', () => {
  const previous = { ...hourlyBucket(1), quiz_answers: 2, quiz_correct: 1 };
  const markup = chartPage('1d', 'hour', [operationalBucket, previous]);
  assert.match(markup, /2 hours plotted\. Activity ranges from 2 to 36 events per hour/);

  const legacy = { ...operationalBucket };
  delete legacy.tickets_reopened;
  delete legacy.anonymous_messages;
  delete legacy.human_messages;
  delete legacy.voice_member_minutes;
  const v1 = page({ analytics: { ranges: { '1d': { ...legacyMetrics, series: [legacy, previous] } } } });
  assert.match(v1, /Activity ranges from 2 to 25 events/);
});

test('value ticks are integers on even steps, start at zero and reach the maximum', () => {
  for (const maximum of [0, 1, 2, 3, 5, 6, 11, 13, 36, 101, 999]) {
    const ticks = analyticsUI.niceTicks(maximum);
    assert.equal(ticks[0], 0);
    assert.ok(ticks.every(Number.isInteger), `integers for ${maximum}`);
    assert.ok(ticks.length >= 3 && ticks.length <= 6, `3 to 6 ticks for ${maximum}`);
    assert.ok(ticks.at(-1) >= maximum);
    const step = ticks[1] - ticks[0];
    assert.ok(ticks.every((tick, index) => tick === index * step));
  }
  const rendered = yTicks(chartPage('1d', 'hour', [operationalBucket, hourlyBucket(1)]));
  assert.deepEqual(rendered, analyticsUI.niceTicks(36));
  assert.doesNotMatch(chartPage('1d', 'hour', [operationalBucket]), /\d\.\d<\/text>/);
});

test('every bucket is labeled when labels fit and thinned evenly with first and last kept when crowded', () => {
  const week = Array.from({ length: 7 }, (_, index) => ({ period_start: new Date(dayStart + index * 24 * hour).toISOString() }));
  const weekLabels = xTickLabels(chartPage('7d', 'day', week)).map(item => item.label);
  assert.deepEqual(weekLabels, ['Nov 19', 'Nov 20', 'Nov 21', 'Nov 22', 'Nov 23', 'Nov 24', 'Nov 25']);

  for (const count of [2, 12, 24, 30, 90]) {
    const labels = Array.from({ length: count }, (_, index) => `Nov ${index + 1}`);
    const slot = 542 / count;
    const { indexes } = analyticsUI.planAxisLabels(labels, slot);
    assert.equal(indexes[0], 0);
    assert.equal(indexes.at(-1), count - 1);
    for (let i = 1; i < indexes.length; i += 1) {
      assert.ok((indexes[i] - indexes[i - 1]) * slot >= (6 * 6.6) + 4 + 10 - 0.01, `no collision at ${count} buckets`);
    }
  }

  const month = Array.from({ length: 30 }, (_, index) => ({ period_start: new Date(dayStart + index * 24 * hour).toISOString() }));
  const thinned = xTickLabels(chartPage('1m', 'day', month));
  assert.equal(thinned[0].label, 'Nov 19');
  assert.equal(thinned.at(-1).label, 'Dec 18');
  assert.ok(thinned.length < 30);
  assert.match(chartPage('1m', 'day', month), /Labels show every (other day|\d+ days)/);
});

test('hourly labels show the hour and daily labels the month and day in the supplied zone', () => {
  const hours = xTickLabels(page(v2Snapshot())).map(item => item.label);
  assert.equal(hours[0], '3 PM');
  assert.equal(hours.at(-1), '2 PM');
  assert.deepEqual(xTickLabels(chartPage('3d', '6hour', [hourlyBucket(0), hourlyBucket(6)])).map(item => item.label), ['Nov 19, 3 PM', 'Nov 19, 9 PM']);
  for (const range of ['7d', '2w', '1m']) {
    assert.deepEqual(xTickLabels(chartPage(range, 'day', [hourlyBucket(0), hourlyBucket(24)])).map(item => item.label), ['Nov 19', 'Nov 20']);
  }
  // Times are local; the page states the update time once and adds no time-zone caption.
  assert.doesNotMatch(page(v2Snapshot()), /Times in /);
});

test('weekly labels include years when the series crosses a local calendar year', () => {
  const buckets = [{ period_start: '2025-12-24T18:00:00Z' }, { period_start: '2025-12-31T18:00:00Z' }];
  assert.deepEqual(xTickLabels(chartPage('all', 'week', buckets)).map(item => item.label), ['Dec 25, 25', 'Jan 1, 26']);
});

test('labels both occurrences of a DST fold with their respective timezone abbreviations', () => {
  const buckets = [{ period_start: '2026-11-01T05:30:00Z' }, { period_start: '2026-11-01T06:30:00Z' }];
  const markup = chartPage('1d', 'hour', buckets, { locale: 'en-US', timeZone: 'America/New_York' });
  assert.deepEqual(xTickLabels(markup).map(item => item.label), ['1 AM EDT', '1 AM EST']);
});

test('draws one point without a line or area for one bucket and omits an empty chart', () => {
  const single = chartPage('1d', 'hour', [operationalBucket]);
  assert.equal((single.match(/data-analytics-point=/g) || []).length, 1);
  assert.doesNotMatch(single, /<polyline|analytics-area/);
  assert.doesNotMatch(chartPage('1d', 'hour', []), /analytics-chart|analytics-line-chart|Breakdown by/);
});

test('the chart has an accessible name listing values, keyboard stops with roving tabindex and a day table', () => {
  const markup = chartPage('7d', 'day', [{ ...hourlyBucket(0), reputation_events: 3 }, { ...hourlyBucket(24), reputation_events: 5 }]);
  assert.match(markup, /<svg class="analytics-line-chart"[^>]*role="group" aria-label="Activity events per day: Nov 19: 3, Nov 20: 5"/);
  assert.match(markup, /<rect class="analytics-hit"[^>]*tabindex="0" role="img" data-analytics-point="0"[^>]*aria-label="[^"]+3 operational events[^"]*"/);
  assert.match(markup, /tabindex="-1" role="img" data-analytics-point="1"/);
  assert.match(markup, /<polyline class="analytics-line-path"/);
  assert.match(markup, /<path class="analytics-area"/);
  assert.match(markup, /data-disclosure="analytics-breakdown"[^>]*data-open="false"/);
  assert.match(markup, /aria-expanded="false"[^>]*>Breakdown by day/);
  assert.match(markup, /<th scope="row">Nov 20<\/th><td>5<\/td><td>5<\/td>/);
  assert.doesNotMatch(markup, /requestAnimationFrame|animation/);
});

function pointElement(attributes) {
  const element = {
    attributes: { ...attributes },
    closest(selector) { return selector === '[data-analytics-point]' ? element : null; },
    getAttribute(name) { return element.attributes[name] ?? null; },
    setAttribute(name, value) { element.attributes[name] = value; },
    removeAttribute(name) { delete element.attributes[name]; },
    focus() { element.onFocus?.(element); },
  };
  return element;
}

function simpleNode() {
  const node = {
    attributes: { hidden: '' },
    innerHTML: '',
    style: { props: {}, setProperty(name, value) { this.props[name] = value; } },
    setAttribute(name, value) { node.attributes[name] = value; },
    removeAttribute(name) { delete node.attributes[name]; },
    getAttribute(name) { return node.attributes[name] ?? null; },
  };
  return node;
}

function interactionRoot() {
  const listeners = new Map();
  const tooltip = simpleNode();
  const guide = simpleNode();
  const dot = simpleNode();
  let points = [];
  let focused = null;
  let ranges = new Map();
  const emit = (type, target, key) => {
    let prevented = false;
    listeners.get(type)?.({ target, key, preventDefault() { prevented = true; } });
    return prevented;
  };
  const root = {
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    querySelectorAll(selector) { return selector === '[data-analytics-point]' ? points : []; },
    querySelector(selector) {
      if (selector === '[data-analytics-tooltip]') return tooltip;
      if (selector === '[data-analytics-guide]') return guide;
      if (selector === '[data-analytics-guide-dot]') return dot;
      return ranges.get(selector) ?? null;
    },
    render(markup) {
      focused = root;
      points = [...markup.matchAll(/<rect class="analytics-hit"[^>]*>/g)].map(([tag]) => {
        const attributes = Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]));
        const point = pointElement(attributes);
        point.onFocus = element => { focused = element; emit('focusin', element); };
        return point;
      });
      ranges = new Map([...markup.matchAll(/data-analytics-range="([^"]+)"/g)].map(([selector, key]) => {
        const button = pointElement({ 'data-analytics-range': key });
        button.closest = query => (query === '[data-analytics-range]' ? button : null);
        return ['[' + selector + ']', button];
      }));
    },
    emit,
    tooltip,
    guide,
    dot,
    get points() { return points; },
    get focused() { return focused; },
  };
  return root;
}

test('hover and focus show a guide line, a dot and a tooltip with the bucket and count', () => {
  const root = interactionRoot();
  root.render(chartPage('1d', 'hour', [operationalBucket, hourlyBucket(1)]));
  const uninstall = analyticsUI.installAnalyticsPageInteractions({ root });
  const [first, second] = root.points;
  assert.equal(root.tooltip.getAttribute('hidden'), '');
  for (const type of ['pointerenter', 'mouseover', 'focusin', 'click']) {
    root.emit('click', second);
    root.emit(type, first);
    assert.match(root.tooltip.innerHTML, /<strong>Nov 19, 3:00 PM GMT\+8<\/strong><span>36 events<\/span>/);
    assert.match(root.tooltip.innerHTML, /Moderation cases 1 · Tickets opened 2 · Tickets closed 3 · Tickets reopened 4 · Quiz answers 5/);
    assert.doesNotMatch(root.tooltip.innerHTML, /correct|accuracy|Human messages/i);
    assert.equal(root.tooltip.getAttribute('hidden'), null);
    assert.equal(root.guide.getAttribute('hidden'), null);
    assert.equal(root.guide.getAttribute('x1'), first.getAttribute('data-cx'));
    assert.equal(root.dot.getAttribute('cy'), first.getAttribute('data-cy'));
    assert.equal(first.getAttribute('data-active'), 'true');
    assert.equal(second.getAttribute('data-active'), null);
  }
  root.emit('click', second);
  assert.match(root.tooltip.innerHTML, /<span>0 events<\/span>/);
  assert.doesNotMatch(root.tooltip.innerHTML, /<small>/);
  root.emit('keydown', first, 'Escape');
  assert.equal(root.tooltip.getAttribute('hidden'), '');
  uninstall();
  root.emit('click', first);
  assert.equal(root.tooltip.getAttribute('hidden'), '');
});

test('ArrowLeft, ArrowRight, Home, and End move focus, rove the tab stop and update the tooltip', () => {
  const root = interactionRoot();
  root.render(chartPage('1d', 'hour', [operationalBucket, hourlyBucket(1), hourlyBucket(2)]));
  analyticsUI.installAnalyticsPageInteractions({ root });
  root.points[0].focus();
  for (const [key, index, time] of [
    ['ArrowRight', 1, '4:00 PM'], ['End', 2, '5:00 PM'], ['ArrowLeft', 1, '4:00 PM'],
    ['Home', 0, '3:00 PM'], ['ArrowLeft', 0, '3:00 PM'],
  ]) {
    assert.equal(root.emit('keydown', root.focused, key), true);
    assert.equal(root.focused, root.points[index]);
    assert.ok(root.tooltip.innerHTML.includes(time));
    assert.deepEqual(root.points.map(point => point.getAttribute('tabindex')), root.points.map((_, position) => (position === index ? '0' : '-1')));
  }
});

test('changing the range rerenders with the new range and restores focus to its button', () => {
  const root = interactionRoot();
  const definition = analyticsUI.createAnalyticsPageDefinition();
  const snapshot = v2Snapshot();
  snapshot.analytics.ranges['7d'].series = [operationalBucket];
  let removeInteractions = () => {};
  let renders = 0;
  let markup = '';
  const rerender = () => {
    removeInteractions();
    markup = definition.render({ state, snapshot });
    root.render(markup);
    removeInteractions = definition.install({ root, rerender });
    renders += 1;
  };
  rerender();
  const selector = '[data-analytics-range="1d"]';
  const originalButton = root.querySelector(selector);
  root.emit('click', originalButton);
  assert.equal(renders, 2);
  assert.match(markup, /data-active-analytics-range="1d"/);
  assert.equal(root.points.length, 24);
  assert.equal(root.tooltip.getAttribute('hidden'), '');
  assert.notEqual(root.focused, originalButton);
});

const readAsset = name => readFileSync(new URL('../docs-site/' + name, import.meta.url), 'utf8');
const stage2bCss = () => readAsset('control-features.css').split('/* Stage 2b: insights, resources and playbooks */')[1] || '';

test('Stage 2b chart and lead styles: 40px tabular lead, 12px labels, soft area, scrolling chart and no chip styling', () => {
  const css = stage2bCss();
  assert.match(css, /\.analytics-lead-total\s*\{[^}]*font-size:\s*40px[^}]*font-weight:\s*600[^}]*font-variant-numeric:\s*tabular-nums/);
  assert.match(css, /\.analytics-axis-tick\s*\{[^}]*font:\s*400 12px/);
  assert.match(css, /\.analytics-area\s*\{[^}]*color-mix\(in srgb, var\(--accent-info\) 8%/);
  assert.match(css, /\.analytics-plot\s*\{[^}]*min-width:\s*560px/);
  assert.match(css, /\.analytics-hit:focus-visible\s*\{[^}]*var\(--focus-ring\)/);
  assert.doesNotMatch(css, /control-state-chip|animation|@keyframes/);
  assert.match(readAsset('control-features.css'), /\.analytics-chart-scroll\s*\{[^}]*overflow-x:\s*auto/);
});

test('Control and public Commands load the same version of the shared Control stylesheet', () => {
  const html = readAsset('control.html');
  const commands = readAsset('commands.html');
  for (const markup of [html, commands]) assert.match(markup, /href="\/control\.css\?v=\d+"/);
  assert.match(html, /href="\/control-features\.css\?v=\d+"/);
  assert.match(html, /src="\/control-app\.js\?v=\d+"/);
  assert.match(readAsset('control-app.js'), /from '\.\/control-analytics\.js\?v=26'/);
});

test('absent closure count renders Unavailable and zero closures renders No closures even if median seconds is set', () => {
  const missing = v2Snapshot({ tickets_closed: undefined, tickets_closed_distinct: undefined, ticket_median_close_seconds: 185 });
  const missingMarkup = page(missing);
  assert.equal(metric(missingMarkup, 'Tickets closed'), 'Unavailable');
  assert.equal(metric(missingMarkup, 'Median time to close'), 'Unavailable');

  const zero = v2Snapshot({ tickets_closed: 0, tickets_closed_distinct: 0, ticket_median_close_seconds: 185 });
  const zeroMarkup = page(zero);
  assert.equal(metric(zeroMarkup, 'Tickets closed'), '0');
  assert.equal(metric(zeroMarkup, 'Median time to close'), 'No closures');
});

test('30 buckets keep non-overlapping hit columns that cover the plot', () => {
  const dayMs = 24 * 60 * 60 * 1000;
  const start = Date.parse('2026-10-21T00:00:00Z');
  const series = Array.from({ length: 30 }, (_, index) => ({
    period_start: new Date(start + index * dayMs).toISOString(),
    period_end: new Date(start + (index + 1) * dayMs).toISOString(),
    reputation_events: 5,
  }));
  const markup = page(v2Snapshot({ range_key: '1m', bucket_granularity: 'day', series }), '1d');
  const hits = [...markup.matchAll(/<rect class="analytics-hit" x="([\d.]+)" y="[\d.]+" width="([\d.]+)"/g)].map(m => ({ x: Number(m[1]), width: Number(m[2]) }));
  assert.equal(hits.length, 30);
  for (let i = 1; i < hits.length; i += 1) assert.ok(hits[i].x + 0.02 >= hits[i - 1].x + hits[i - 1].width);
});

test('saving analytics sends the same request JSON as before the redesign', async () => {
  const { insightsSaveRequests } = await import('./fixtures/stage2b-insights-scenarios.js');
  const expected = JSON.parse(readFileSync(new URL('./fixtures/stage2b-insights-save-requests.json', import.meta.url), 'utf8'));
  assert.deepEqual(insightsSaveRequests().analytics, expected.analytics);
});
