import { controlPageHeaderMarkup, disclosure, escapeHtml, settingsSection } from './control-components.js?v=28';
import { controlIcon } from './control-icons.js?v=3';
import { activityTotal, rangeProjection } from './control-analytics.js?v=30';
import { problemsFromSnapshot } from './control-problems.js?v=2';
import { FEATURE_RESOURCE_KEYS_BY_PAGE } from './control-resource-contract.js';
import { MAPPING_RESOURCE_DEFINITIONS } from './control-mappings.js';
import { resourceOptionLabel } from './control-resource-bindings.js?v=6';
import { destinationForPath } from './control-router.js?v=3';

export const OVERVIEW_PATH = '/control/overview';
const ANALYTICS_PATH = '/control/analytics';

// Which snapshot feature switch each feature page follows. A page without one is always on.
const FEATURE_SWITCH = Object.freeze({
  '/control/community/reputation': 'reputation',
  '/control/community/quizzes': 'quizzes',
  '/control/community/voice-coworking': 'voice',
  '/control/community/showcase': 'showcase',
  '/control/content/feeds': 'ai_updates',
  '/control/content/announcements': 'announcements',
  '/control/content/live': 'live_announcements',
  '/control/utilities/ticket-configuration': 'tickets',
  '/control/utilities/anonymous-questions': 'anonymous_questions',
  '/control/workflows/moderation': 'moderation',
  '/control/analytics': 'analytics',
});

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

function featureEnabled(snapshot, path) {
  const name = FEATURE_SWITCH[path];
  if (!name) return true;
  const feature = (snapshot?.features || []).find(item => item?.name === name);
  return feature ? feature.enabled !== false : true;
}

// The bound Discord resource as members see it (#name, @name), or '' when unbound or deleted.
function boundName(snapshot, key) {
  const row = (snapshot?.resources || []).find(item => item?.key === key);
  if (!row || row.id == null || row.id === '' || row.exists === false || !row.name) return '';
  return resourceOptionLabel(MAPPING_RESOURCE_DEFINITIONS[key]?.kind || row.kind, row.name);
}

function tierSummary(snapshot) {
  const values = Object.values(snapshot?.reputation?.thresholds || {}).map(Number).filter(Number.isFinite);
  if (!values.length) return '';
  return `${plural(values.length, 'tier')}, ${Math.min(...values)} to ${Math.max(...values)} points`;
}

function quizSummary(snapshot) {
  const quiz = snapshot?.quiz;
  if (!quiz || !Array.isArray(quiz.questions)) return '';
  const questions = quiz.questions.length ? plural(quiz.questions.length, 'question') : 'No questions yet';
  const hours = Number(quiz.interval_hours);
  if (!Number.isFinite(hours) || hours <= 0) return questions;
  return `${questions}, ${hours === 1 ? 'every hour' : `every ${hours} hours`}`;
}

// One factual line per feature, from the snapshot. Empty when the snapshot cannot say.
const SUMMARIES = Object.freeze({
  '/control/community/reputation': snapshot => tierSummary(snapshot),
  '/control/community/quizzes': snapshot => quizSummary(snapshot),
  '/control/community/voice-coworking': snapshot => {
    const name = boundName(snapshot, 'create_workspace_voice');
    return name ? `Rooms from ${name}` : '';
  },
  '/control/community/showcase': snapshot => {
    const name = boundName(snapshot, 'showcase_forum');
    return name ? `Spotlights in ${name}` : '';
  },
  '/control/utilities/notification-roles': snapshot => {
    const buttons = snapshot?.notification_panel?.buttons;
    if (!Array.isArray(buttons)) return '';
    return buttons.length ? plural(buttons.length, 'role button') : 'No buttons yet';
  },
  '/control/content/feeds': snapshot => {
    const sources = snapshot?.ai_sources;
    if (!Array.isArray(sources)) return '';
    return sources.length ? plural(sources.length, 'source') : 'No sources yet';
  },
  '/control/content/announcements': snapshot => {
    const name = boundName(snapshot, 'announcements');
    return name ? `Posts to ${name}` : '';
  },
  '/control/content/live': snapshot => {
    const name = boundName(snapshot, 'live_announcements');
    return name ? `Posts to ${name}` : '';
  },
  '/control/utilities/ticket-configuration': snapshot => {
    const types = snapshot?.ticket_types;
    if (!Array.isArray(types)) return '';
    const active = types.filter(item => item?.enabled).length;
    return active ? plural(active, 'ticket type') : 'No ticket types yet';
  },
  '/control/utilities/anonymous-questions': snapshot => {
    const name = boundName(snapshot, 'anon_questions');
    return name ? `Questions go to ${name}` : '';
  },
  '/control/workflows/moderation': snapshot => {
    const name = boundName(snapshot, 'moderation_log');
    return name ? `Logs to ${name}` : '';
  },
  '/control/analytics': snapshot => {
    const name = boundName(snapshot, 'analytics');
    return name ? `Weekly report to ${name}` : '';
  },
});

export function featureSummary(path, snapshot) {
  if (!featureEnabled(snapshot, path)) return 'Off';
  return SUMMARIES[path]?.(snapshot) || '';
}

/* ---------- Needs attention ---------- */

const CHOOSE_VERB = Object.freeze({ role: 'Choose role', category: 'Choose category' });

// Settings rows use resource-<key>. The announcement destination lives in the composer instead.
const FOCUS_ID = Object.freeze({ announcements: 'announcement-destination' });

// One sentence that names the resource, so every row reads the same way.
const KIND_NOUN = Object.freeze({ text: 'channel', voice: 'channel', channel: 'channel', forum: 'forum', category: 'category', role: 'role' });
export function causeSentence(label, cause, kind = '') {
  if (!label) return cause;
  const lower = label.charAt(0).toLowerCase() + label.slice(1);
  // "Live announcements" reads as a plural; naming the object keeps the verb right.
  const noun = /(channel|role|category|forum|log|panel|lounge|trap|voice)$/i.test(label) || !KIND_NOUN[kind] ? lower : `${lower} ${KIND_NOUN[kind]}`;
  if (cause === 'Deleted in Discord.') return `The ${noun} was deleted in Discord.`;
  if (cause === 'Not connected.') return `The ${noun} is not connected.`;
  if (cause === "Rob-bot can't send messages there.") return `Rob-bot can't send messages in ${lower}.`;
  if (cause === "Rob-bot can't embed links there.") return `Rob-bot can't embed links in ${lower}.`;
  return `${name}: ${cause}`;
}

// Pure: problems model to display rows. One row per problem, each with the control that fixes it.
export function attentionItems(problems = []) {
  const counts = new Map();
  for (const problem of problems) counts.set(problem.path, (counts.get(problem.path) || 0) + 1);
  return problems.map(problem => {
    const definition = MAPPING_RESOURCE_DEFINITIONS[problem.resourceKey];
    return {
      path: problem.path,
      title: problem.title,
      cause: causeSentence(definition?.label, problem.cause, definition?.kind),
      action: CHOOSE_VERB[definition?.kind] || 'Choose channel',
      focus: FOCUS_ID[problem.resourceKey] || `resource-${problem.resourceKey}`,
    };
  });
}

function attentionMarkup(items) {
  const rows = items.map((item, index) => `<li class="overview-problem" data-overview-problem>
    ${controlIcon('warning', { size: 16, className: 'overview-problem-icon' })}
    <div class="overview-problem-copy"><p class="overview-problem-title" id="overview-problem-${index}">${escapeHtml(item.title)}</p><p class="overview-problem-cause">${escapeHtml(item.cause)}</p></div>
    <button type="button" class="control-button control-button-secondary" data-overview-link="${escapeHtml(item.path)}" data-overview-focus="${escapeHtml(item.focus)}" aria-describedby="overview-problem-${index}">${escapeHtml(item.action)}</button>
  </li>`).join('');
  return settingsSection({
    id: 'overview-attention-heading',
    title: 'Needs attention',
    body: `<ul class="overview-problems">${rows}</ul>`,
  });
}

/* ---------- Last 7 days ---------- */

// Pure: the 7d projection to a total and one bar per day. Null when the snapshot has no 7d data.
export function weekSummary(snapshot, { locale, timeZone } = {}) {
  const { selectedRange, projection } = rangeProjection(snapshot, '7d');
  if (!projection || selectedRange !== '7d') return null;
  const series = (Array.isArray(projection.series) ? projection.series : []).slice(-7);
  const initial = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone });
  const short = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone });
  const bars = series.map(bucket => {
    const date = new Date(bucket?.period_start);
    const valid = Number.isFinite(date.getTime());
    return {
      value: activityTotal(bucket),
      initial: valid ? initial.format(date) : '',
      name: valid ? short.format(date) : '',
    };
  });
  return { total: activityTotal(projection), bars };
}

export function weekChartLabel(week) {
  return `Events per day: ${week.bars.map(bar => `${bar.name ? `${bar.name} ` : ''}${bar.value}`).join(', ')}`;
}

function weekMarkup(week) {
  const peak = Math.max(0, ...week.bars.map(bar => bar.value));
  const bars = week.bars.map(bar => `<span class="overview-bar" data-value="${bar.value}"><span class="overview-bar-value">${bar.value}</span><span class="overview-bar-track"><span class="overview-bar-fill" style="--h:${peak ? Math.round((bar.value / peak) * 100) : 0}%"></span></span><span class="overview-bar-day">${escapeHtml(bar.initial)}</span></span>`).join('');
  const chart = week.bars.length
    ? `<span class="overview-bars" role="img" aria-label="${escapeHtml(weekChartLabel(week))}">${bars}</span>`
    : '';
  return settingsSection({
    id: 'overview-week-heading',
    title: 'Last 7 days',
    body: `<a class="overview-week" href="${ANALYTICS_PATH}" data-overview-link="${ANALYTICS_PATH}">
      <span class="overview-week-lead"><span class="overview-week-total" data-overview-total>${week.total}</span><span class="overview-week-label">events</span></span>
      ${chart}
    </a>`,
  });
}

/* ---------- Features running normally ---------- */

// Pure: every registered feature page without a problem, with its one-line summary.
export function healthyFeatures(snapshot, problems = problemsFromSnapshot(snapshot)) {
  const broken = new Set(problems.map(problem => problem.path));
  return Object.keys(FEATURE_RESOURCE_KEYS_BY_PAGE)
    .filter(path => !broken.has(path))
    .map(path => ({
      path,
      label: destinationForPath(path)?.label || path,
      summary: featureSummary(path, snapshot),
      enabled: featureEnabled(snapshot, path),
    }));
}

function healthyMarkup(features) {
  if (!features.length) return '';
  const running = features.filter(feature => feature.enabled).length;
  const label = running ? `${plural(running, 'feature')} running normally` : 'No features running';
  const rows = features.map(feature => `<li><a class="overview-feature" href="${escapeHtml(feature.path)}" data-overview-link="${escapeHtml(feature.path)}"><span class="overview-feature-name">${escapeHtml(feature.label)}</span>${feature.summary ? `<span class="overview-feature-summary">${escapeHtml(feature.summary)}</span>` : ''}</a></li>`).join('');
  return disclosure({ id: 'overview-healthy', label, body: `<ul class="overview-features">${rows}</ul>`, className: 'overview-healthy' });
}

/* ---------- Page ---------- */

export function overviewPageMarkup({ snapshot, locale, timeZone } = {}) {
  const header = controlPageHeaderMarkup({ title: 'Overview', editable: false });
  if (!snapshot || typeof snapshot !== 'object') {
    return `<section class="control-page overview-page" data-page-key="${OVERVIEW_PATH}">${header}<p class="control-empty-line">Load current server state to see what needs attention.</p></section>`;
  }
  const problems = problemsFromSnapshot(snapshot);
  const attention = problems.length
    ? attentionMarkup(attentionItems(problems))
    : '<p class="overview-ok" data-overview-ok>Everything is running.</p>';
  const week = weekSummary(snapshot, { locale, timeZone });
  return `<section class="control-page overview-page" data-page-key="${OVERVIEW_PATH}">
    ${header}
    ${attention}
    ${week ? weekMarkup(week) : ''}
    ${healthyMarkup(healthyFeatures(snapshot, problems))}
  </section>`;
}
