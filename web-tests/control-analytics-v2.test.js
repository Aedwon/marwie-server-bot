import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import * as analyticsUI from '../docs-site/control-analytics.js';

const state = { mode: 'read', status: 'clean', persisted: { enabled: true } };
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

test('formats timestamps and selected bounds in the supplied local timezone', () => {
  const local = analyticsUI.formatLocalTimestamp(generatedAt, manila);
  assert.match(local, /3:15 PM/);
  assert.doesNotMatch(local, /\bUTC\b/);
  assert.match(page(v2Snapshot()), /<strong>From<\/strong> Nov 19, 2026, 3:00 PM GMT\+8/);
  assert.match(page(v2Snapshot()), /<strong>To<\/strong> Nov 20, 2026, 3:00 PM GMT\+8/);
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
  assert.doesNotMatch(page(snapshot, '1m'), /analytics-coverage-list|Passive telemetry disabled/);
});

test('shows v2 ticket events and the current backlog with the same value across ranges', () => {
  const snapshot = v2Snapshot();
  const day = page(snapshot);
  const week = page(snapshot, '7d');
  assert.equal(metric(day, 'Open tickets (current)'), '8');
  assert.equal(metric(week, 'Open tickets (current)'), '8');
  assert.equal(metric(day, 'Tickets closed'), '4 (3 distinct)');
  assert.equal(metric(week, 'Tickets closed'), '3');
  assert.equal(metric(day, 'Tickets reopened'), '2');
  assert.equal(metric(day, 'Anonymous messages'), '9');
  assert.equal(metric(day, 'Median ticket close time'), '3m 5s');
});

test('distinguishes no quiz answers from zero accuracy', () => {
  assert.equal(metric(page(v2Snapshot()), 'Quiz accuracy'), 'No answers');
  const markup = page(v2Snapshot({ quiz_answers: 4, quiz_correct: 0, quiz_accuracy: 0 }));
  assert.equal(metric(markup, 'Quiz accuracy'), '0%');
});

test('shows disabled passive counters and preserves backend coverage notes verbatim', () => {
  const note = 'Passive telemetry disabled (1 gap, 3 dropped)';
  const markup = page(v2Snapshot({
    human_messages: 0,
    coverage: { business_events: complete, messages: { ...disabled, note }, voice: disabled },
  }));
  assert.equal(metric(markup, 'Human messages'), 'Unavailable');
  assert.equal(metric(markup, 'Voice member minutes'), 'Unavailable');
  assert.match(markup, /class="control-state-chip">Unavailable<\/span>/);
  assert.match(markup, /Passive telemetry disabled \(1 gap, 3 dropped\)<\//);
  assert.equal((markup.match(/3 dropped/g) || []).length, 1);
});

test('uses each passive coverage status even when its covered ratio is zero or one', () => {
  const markup = page(v2Snapshot({
    human_messages: 42,
    coverage: {
      business_events: { ...complete, status: 'partial', covered_ratio: 0 },
      messages: { ...complete, status: 'partial', dropped_events: 3 },
      voice: disabled,
    },
  }));
  assert.equal(metric(markup, 'Human messages'), '42 (partial)');
  assert.equal(metric(markup, 'Voice member minutes'), 'Unavailable');
  assert.equal((markup.match(/data-tone="warning">Partial<\/span>/g) || []).length, 2);
  assert.match(markup, />100% covered · 3 dropped</);
  assert.match(markup, />0% covered</);
});

test('keeps measured passive zeros, partial voice minutes, and nullable counts distinct', () => {
  const markup = page(v2Snapshot({
    human_messages: 0,
    voice_member_minutes: 0,
    coverage: { business_events: complete, messages: complete, voice: complete },
  }));
  assert.equal(metric(markup, 'Human messages'), '0');
  assert.equal(metric(markup, 'Voice member minutes'), '0 min');
  assert.doesNotMatch(markup, /\(partial\)|% covered/);
  assert.equal((markup.match(/data-tone="good">Complete<\/span>/g) || []).length, 3);

  const partial = page(v2Snapshot({
    voice_member_minutes: 12.5,
    coverage: { business_events: complete, messages: complete, voice: { ...complete, status: 'partial' } },
  }));
  assert.equal(metric(partial, 'Human messages'), 'Unavailable');
  assert.equal(metric(partial, 'Voice member minutes'), '12.5 min (partial)');
});

test('preserves seven legacy rows and only charts supplied ranged v1 buckets', () => {
  const flat = page({ analytics: legacyMetrics });
  assert.equal((flat.match(/class="control-stat-row"/g) || []).length, 7);
  assert.doesNotMatch(flat.slice(flat.indexOf('data-active-analytics-range')), /<svg|analytics-coverage-list/);
  const projection = { ...legacyMetrics, series: [hourlyBucket(0), hourlyBucket(1)] };
  const ranged = page({ analytics: { default_range: '1d', ranges: { '1d': projection } } });
  assert.equal((ranged.match(/class="control-stat-row"/g) || []).length, 7);
  assert.equal((ranged.match(/data-analytics-range=/g) || []).length, 6);
  assert.equal((ranged.match(/data-analytics-point=/g) || []).length, 2);
  assert.doesNotMatch(ranged, /analytics-coverage-list/);
});

test('keeps the report permission and shows generation time and passive availability in Context', () => {
  const definition = analyticsUI.createAnalyticsPageDefinition();
  const snapshot = v2Snapshot();
  const context = definition.renderContext({ state, snapshot, ...manila });
  assert.equal(metric(context, 'Send permission'), 'Missing Send Messages or not a text channel');
  assert.match(metric(context, 'Last generated'), /3:15 PM GMT\+8/);
  assert.match(metric(context, 'Data source'), /passive telemetry unavailable/i);
  const edit = definition.renderContext({ state: { ...state, mode: 'edit' }, snapshot, ...manila });
  assert.doesNotMatch(edit, /<dt>Channel<\/dt>/);
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
  const axis = markup.split('class="analytics-axis analytics-axis-x"')[1].split('</svg>')[0];
  return [...axis.matchAll(/<g class="analytics-axis-tick">[^<]*<line[^>]*><\/line><text[^>]*>([^<]*)<\/text>/g)]
    .map(([, label]) => label);
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
  assert.match(markup, /2 real buckets plotted for 1d\. Activity ranges from 2 to 36 operational events/);

  const legacy = { ...operationalBucket };
  delete legacy.tickets_reopened;
  delete legacy.anonymous_messages;
  delete legacy.human_messages;
  delete legacy.voice_member_minutes;
  const v1 = page({ analytics: { ranges: { '1d': { ...legacyMetrics, series: [legacy, previous] } } } });
  assert.match(v1, /Activity ranges from 2 to 25 operational events/);
});

test('uses time on hour and six-hour ticks and uses month and day on daily ticks', () => {
  const houred = xTickLabels(page(v2Snapshot()));
  assert.equal(houred.length, 6);
  assert.equal(houred[0], 'Nov 19, 3:00 PM');
  assert.equal(houred.at(-1), 'Nov 20, 2:00 PM');

  assert.deepEqual(xTickLabels(chartPage('3d', '6hour', [hourlyBucket(0), hourlyBucket(6)])), [
    'Nov 19, 3:00 PM', 'Nov 19, 9:00 PM',
  ]);
  for (const range of ['7d', '2w', '1m']) {
    assert.deepEqual(xTickLabels(chartPage(range, 'day', [hourlyBucket(0), hourlyBucket(24)])), [
      'Nov 19', 'Nov 20',
    ]);
  }
});

test('weekly ticks include years when the series crosses a local calendar year', () => {
  const buckets = [{ period_start: '2025-12-24T18:00:00Z' }, { period_start: '2025-12-31T18:00:00Z' }];
  assert.deepEqual(xTickLabels(chartPage('all', 'week', buckets)), ['Dec 25, 25', 'Jan 1, 26']);
});

test('labels both occurrences of a DST fold with their respective timezone abbreviations', () => {
  const buckets = [{ period_start: '2026-11-01T05:30:00Z' }, { period_start: '2026-11-01T06:30:00Z' }];
  const markup = chartPage('1d', 'hour', buckets, { locale: 'en-US', timeZone: 'America/New_York' });
  assert.deepEqual(xTickLabels(markup), ['Nov 1, 1:30 AM EDT', 'Nov 1, 1:30 AM EST']);
});

test('draws one point without a connecting line for one bucket and omits an empty chart', () => {
  const single = chartPage('1d', 'hour', [operationalBucket]);
  assert.equal((single.match(/data-analytics-point=/g) || []).length, 1);
  assert.doesNotMatch(single, /<polyline/);
  assert.doesNotMatch(chartPage('1d', 'hour', []), /analytics-chart-section|analytics-line-chart/);
});

test('keeps focusable chart buttons inside an accessible group and the inspector outside the scroller', () => {
  const markup = chartPage('1d', 'hour', [operationalBucket]);
  assert.match(markup, /<svg class="analytics-line-chart"[^>]*viewBox="0 0 640 264"[^>]*role="group"/);
  assert.doesNotMatch(markup, /<svg class="analytics-line-chart"[^>]*role="img"/);
  assert.match(markup, /<g class="analytics-point-group" tabindex="0" role="button" data-analytics-point="0"[^>]*aria-label="[^"]+36 operational events[^"]*"/);
  assert.match(markup, /<figure class="analytics-chart">\s*<div class="analytics-chart-scroll">\s*<svg[^]*?<\/svg>\s*<\/div>\s*<div class="analytics-chart-inspector" data-analytics-inspector aria-live="polite">[^<]+<\/div>\s*<figcaption>/);
});

function interactionRoot() {
  const listeners = new Map();
  let points;
  let ranges;
  let focused;
  let inspector;
  let markup;
  const emit = (type, target, key) => {
    let prevented = false;
    listeners.get(type)?.({
      target,
      key,
      preventDefault() { prevented = true; },
    });
    return prevented;
  };
  const element = (selector, attributes) => ({
    closest(query) { return query === selector ? this : null; },
    getAttribute(name) { return attributes[name] ?? null; },
    setAttribute(name, value) { attributes[name] = value; },
    removeAttribute(name) { delete attributes[name]; },
    focus() {
      focused = this;
      emit('focusin', this);
    },
  });
  const root = {
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    querySelectorAll(selector) { return selector === '[data-analytics-point]' ? points : []; },
    querySelector(selector) {
      if (selector === '[data-analytics-inspector]') return inspector;
      return ranges.get(selector);
    },
    render(rendered) {
      markup = rendered;
      focused = root;
      const pointTags = [...rendered.matchAll(/<g class="analytics-point-group"[^>]*>/g)];
      points = pointTags.map(([tag]) => {
        const attributes = Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => [name, value]));
        return element('[data-analytics-point]', attributes);
      });
      ranges = new Map([...rendered.matchAll(/data-analytics-range="([^"]+)"/g)].map(([selector, key]) =>
        ['[' + selector + ']', element('[data-analytics-range]', { 'data-analytics-range': key })]));
      inspector = { textContent: rendered.match(/data-analytics-inspector[^>]*>([^<]*)<\/div>/)?.[1] };
    },
    emit,
    get points() { return points; },
    get focused() { return focused; },
    get inspector() { return inspector; },
    get markup() { return markup; },
  };
  return root;
}

test('hover, focus, click, Enter, and Space expose the selected bucket breakdown', () => {
  const root = interactionRoot();
  root.render(chartPage('1d', 'hour', [operationalBucket, hourlyBucket(1)]));
  const uninstall = analyticsUI.installAnalyticsPageInteractions({ root });
  const [first, second] = root.points;
  for (const [type, key] of [['pointerenter'], ['mouseover'], ['focusin'], ['click'], ['keydown', 'Enter'], ['keydown', ' ']]) {
    root.emit('click', second);
    root.emit(type, first, key);
    assert.match(root.inspector.textContent, /Nov 19, 2026, 3:00 PM GMT\+8/);
    assert.match(root.inspector.textContent, /36 operational events/);
    for (const fragment of [
      'Moderation cases: 1', 'Tickets opened: 2', 'Tickets closed: 3', 'Tickets reopened: 4',
      'Quiz answers: 5', 'Anonymous questions: 6', 'Anonymous messages: 7', 'Reputation events: 8',
      'Human messages: 0', 'Voice minutes: 12.5',
    ]) assert.ok(root.inspector.textContent.includes(fragment), fragment);
    assert.doesNotMatch(root.inspector.textContent, /correct|accuracy/i);
    assert.equal(first.getAttribute('data-active'), 'true');
    assert.equal(second.getAttribute('data-active'), null);
  }
  root.emit('click', second);
  assert.match(root.inspector.textContent, /0 operational events/);
  assert.doesNotMatch(root.inspector.textContent, /Human messages|Voice minutes|Tickets/);
  uninstall();
  root.emit('click', first);
  assert.match(root.inspector.textContent, /0 operational events/);
});

test('ArrowLeft, ArrowRight, Home, and End move focus and update the bucket inspector', () => {
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
    assert.ok(root.inspector.textContent.includes(time));
  }
});

test('changing the range resets inspection and restores focus after rerender', () => {
  const root = interactionRoot();
  const definition = analyticsUI.createAnalyticsPageDefinition();
  const snapshot = v2Snapshot();
  snapshot.analytics.ranges['7d'].series = [operationalBucket];
  let removeInteractions = () => {};
  let renders = 0;
  const rerender = () => {
    removeInteractions();
    root.render(definition.render({ state, snapshot }));
    removeInteractions = definition.install({ root, rerender });
    renders += 1;
  };
  rerender();
  root.points[0]?.focus();
  const selector = '[data-analytics-range="1d"]';
  const originalButton = root.querySelector(selector);
  root.emit('click', originalButton);
  assert.equal(renders, 2);
  assert.match(root.markup, /data-active-analytics-range="1d"/);
  assert.equal(root.points.length, 24);
  assert.equal(root.inspector.textContent, 'Select, focus, or hover a point to inspect bucket counts.');
  assert.ok(root.points.every(point => point.getAttribute('data-active') === null));
  assert.notEqual(root.focused, originalButton);
  assert.equal(root.focused, root.querySelector(selector));
});

const readAsset = name => readFileSync(new URL('../docs-site/' + name, import.meta.url), 'utf8');

test('coverage chips use semantic warning and info tokens for text, border, and background', () => {
  const css = readAsset('control.css');
  for (const tone of ['warning', 'info']) {
    const block = css.match(new RegExp('\\.control-state-chip\\[data-tone="' + tone + '"\\]\\s*\\{([^}]*)\\}'))?.[1];
    assert.ok(block, tone);
    for (const suffix of ['fg', 'stroke', 'bg']) assert.ok(block.includes('--status-' + tone + '-' + suffix));
  }
});

test('only the chart scrolls horizontally and axes and inspector use readable tabular numbers', () => {
  const css = readAsset('control-features.css');
  assert.match(css, /\.analytics-chart-scroll\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(css, /\.analytics-line-chart\s*\{[^}]*min-width:\s*600px/);
  assert.match(css, /\.analytics-axis-label,\s*\.analytics-axis-tick\s*\{[^}]*font:\s*400 13px [^}]*font-variant-numeric:\s*tabular-nums/);
  assert.match(css, /\.analytics-chart-inspector\s*\{[^}]*border:\s*1px solid var\(--stroke-subtle\)[^}]*font-size:\s*13px[^}]*font-variant-numeric:\s*tabular-nums/);
  assert.doesNotMatch(css, /\.analytics-chart\s*\{[^}]*overflow-x:/);
});

test('coverage can stack in a narrow workspace and chart points have a visible focus treatment', () => {
  const css = readAsset('control-features.css');
  const narrow = css.split('@container control-main (max-width: 720px)')[1]?.split('@container')[0];
  assert.match(narrow, /\.analytics-coverage-list\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.match(css, /\.analytics-point-group:focus-visible\s+\.analytics-line-hit\s*\{[^}]*stroke:\s*var\(--focus-ring\)/);
});

test('Control and public Commands load the same version of the shared Control stylesheet', () => {
  const html = readAsset('control.html');
  const commands = readAsset('commands.html');
  for (const markup of [html, commands]) assert.match(markup, /href="\/control\.css\?v=32"/);
  assert.match(html, /href="\/control-features\.css\?v=16"/);
  assert.match(html, /src="\/control-app\.js\?v=30"/);
  assert.match(readAsset('control-app.js'), /from '\.\/control-analytics\.js\?v=21'/);
});
