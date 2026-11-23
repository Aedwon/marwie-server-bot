import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  OVERVIEW_PATH,
  attentionItems,
  featureSummary,
  healthyFeatures,
  overviewPageMarkup,
  weekChartLabel,
  weekSummary,
} from '../docs-site/control-overview.js';
import { problemsFromSnapshot } from '../docs-site/control-problems.js';
import { FEATURE_RESOURCE_KEYS_BY_PAGE } from '../docs-site/control-resource-contract.js';
import { registerCommunityPages } from '../docs-site/control-community.js';
import { registerContentPages } from '../docs-site/control-content.js';
import { registerUtilitiesPages } from '../docs-site/control-utilities.js';
import { registerAnalyticsPage } from '../docs-site/control-analytics.js';
import { registerWorkflowPages } from '../docs-site/control-workflows.js';
import { registerMappingPages } from '../docs-site/control-mappings.js';
import {
  controlState,
  hydrateControlPages,
  renderRegisteredControlPage,
} from '../docs-site/control-page-registry.js';
import { controlIcon, hasControlIcon } from '../docs-site/control-icons.js';
import { destinationForPath, resolveControlRoute } from '../docs-site/control-router.js';
import { controlRouteRevisions, controlRouteSnapshot } from './fixtures/control-route-snapshot.js';

const read = name => readFileSync(new URL(`../docs-site/${name}`, import.meta.url), 'utf8');
const UTC = { timeZone: 'UTC', locale: 'en-US' };
const QUIZZES = '/control/community/quizzes';

function patch(snapshot, key, change) {
  Object.assign(snapshot.resources.find(item => item.key === key), change);
  return snapshot;
}

function week(values, { start = '2026-10-19T00:00:00+00:00' } = {}) {
  const base = new Date(start).getTime();
  return values.map((value, index) => ({
    period_start: new Date(base + (index * 86400000)).toISOString(),
    period_end: new Date(base + ((index + 1) * 86400000)).toISOString(),
    quiz_answers: value,
  }));
}

/* ---------- Needs attention ---------- */

test('each problem is one row with the warning icon, title, cause and one fix button', () => {
  const snapshot = patch(controlRouteSnapshot(), 'quiz_channel', { exists: false });
  const markup = overviewPageMarkup({ snapshot, ...UTC });
  assert.match(markup, /<h1>Overview<\/h1>/);
  assert.doesNotMatch(markup, /control-page-intro/, 'Overview has no lede');
  assert.match(markup, />Needs attention<\/h2>/);
  assert.equal((markup.match(/data-overview-problem/g) || []).length, 1);
  assert.match(markup, /<svg[^>]*class="overview-problem-icon"/);
  assert.match(markup, /overview-problem-title" id="overview-problem-0">Quizzes can&#39;t post<\/p>/);
  // Every cause names its resource in one sentence.
  assert.match(markup, /overview-problem-cause">The [^<]* was deleted in Discord\.<\/p>/);
  assert.match(markup, new RegExp(`data-overview-link="${QUIZZES}" data-overview-focus="resource-quiz_channel" aria-describedby="overview-problem-0">Choose channel</button>`));
  assert.doesNotMatch(markup, /Everything is running/);
});

test('the fix verb follows the kind of resource and a shared page names which resource', () => {
  const snapshot = controlRouteSnapshot();
  snapshot.resources = snapshot.resources.filter(item => !['builder_role', 'temp_voice_category'].includes(item.key));
  const items = attentionItems(problemsFromSnapshot(snapshot));
  const byKey = Object.fromEntries(items.map(item => [item.focus, item]));
  assert.equal(byKey['resource-builder_role'].action, 'Choose role');
  assert.equal(byKey['resource-builder_role'].cause, 'The builder role is not connected.');
  assert.equal(byKey['resource-temp_voice_category'].action, 'Choose category');
  assert.equal(byKey['resource-temp_voice_category'].path, '/control/community/voice-coworking');
});

test('a healthy snapshot says Everything is running in one italic line and shows no attention section', () => {
  const markup = overviewPageMarkup({ snapshot: controlRouteSnapshot(), ...UTC });
  assert.match(markup, /<p class="overview-ok" data-overview-ok>Everything is running\.<\/p>/);
  assert.doesNotMatch(markup, /Needs attention|data-overview-problem/);
  const css = read('control-features.css');
  assert.match(css, /\.overview-ok \{[^}]*font: italic 400 22px\/1\.3 "Newsreader"/);
  assert.match(read('control.html'), /family=Newsreader:ital,wght@1,400/);
});

test('without server state Overview claims nothing', () => {
  const markup = overviewPageMarkup({ snapshot: null });
  assert.match(markup, /Load current server state/);
  assert.doesNotMatch(markup, /Everything is running|Last 7 days/);
});

test('every problem fix button lands on a control that exists on the target page', () => {
  registerCommunityPages();
  registerContentPages();
  registerUtilitiesPages();
  registerAnalyticsPage();
  registerWorkflowPages();
  registerMappingPages();
  const optional = new Set(['live_ping_role', 'compromised_account_trap', 'coworking_lounge', 'app_of_the_week', 'collab_lfg', 'ticket_logs']);
  for (const [path, keys] of Object.entries(FEATURE_RESOURCE_KEYS_BY_PAGE)) {
    for (const key of keys.filter(item => !optional.has(item))) {
      const snapshot = controlRouteSnapshot();
      snapshot.resources = snapshot.resources.filter(item => item.key !== key);
      hydrateControlPages(snapshot, controlRouteRevisions());
      const [problem] = attentionItems(problemsFromSnapshot(snapshot).filter(item => item.resourceKey === key));
      assert.ok(problem, `${key} reports a problem`);
      assert.equal(problem.path, path);
      const page = renderRegisteredControlPage(path, { snapshot });
      assert.ok(page.includes(`id="${problem.focus}"`), `${path} renders #${problem.focus}`);
      if (key === 'announcements') assert.equal(problem.focus, 'announcement-destination');
    }
  }
  hydrateControlPages(controlRouteSnapshot(), controlRouteRevisions());
  assert.ok(controlState);
});

/* ---------- Last 7 days ---------- */

test('Last 7 days totals the 7d projection and links to Analytics with a named chart', () => {
  const snapshot = controlRouteSnapshot();
  const summary = weekSummary(snapshot, UTC);
  assert.equal(summary.total, 43);
  assert.deepEqual(summary.bars.map(bar => [bar.initial, bar.name, bar.value]), [['W', 'Wed', 8], ['T', 'Tue', 35]]);
  const markup = overviewPageMarkup({ snapshot, ...UTC });
  assert.match(markup, />Last 7 days<\/h2>/);
  assert.match(markup, /<a class="overview-week" href="\/control\/analytics" data-overview-link="\/control\/analytics">/);
  assert.match(markup, /data-overview-total>43<\/span><span class="overview-week-label">events<\/span>/);
  assert.match(markup, /role="img" aria-label="Events per day: Wed 8, Tue 35"/);
});

test('seven days give seven bars with weekday initials, values and heights from zero', () => {
  const snapshot = controlRouteSnapshot();
  snapshot.analytics.ranges['7d'].series = week([0, 5, 10, 0, 2, 4, 1]);
  const summary = weekSummary(snapshot, UTC);
  assert.deepEqual(summary.bars.map(bar => bar.initial), ['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  assert.equal(weekChartLabel(summary), 'Events per day: Mon 0, Tue 5, Wed 10, Thu 0, Fri 2, Sat 4, Sun 1');
  const markup = overviewPageMarkup({ snapshot, ...UTC });
  assert.equal((markup.match(/class="overview-bar"/g) || []).length, 7);
  assert.match(markup, /data-value="10"><span class="overview-bar-value">10<\/span><span class="overview-bar-track"><span class="overview-bar-fill" style="--h:100%">/);
  assert.match(markup, /data-value="0"><span class="overview-bar-value">0<\/span><span class="overview-bar-track"><span class="overview-bar-fill" style="--h:0%">/);
  assert.match(markup, /<span class="overview-bar-day">M<\/span>/);
});

test('the week block is omitted when the snapshot has no 7d projection', () => {
  const snapshot = controlRouteSnapshot();
  snapshot.analytics.ranges = { '1m': snapshot.analytics.ranges['7d'] };
  snapshot.analytics.default_range = '1m';
  assert.equal(weekSummary(snapshot), null);
  assert.doesNotMatch(overviewPageMarkup({ snapshot }), /Last 7 days/);
  delete snapshot.analytics;
  assert.doesNotMatch(overviewPageMarkup({ snapshot }), /Last 7 days/);
});

/* ---------- Features running normally ---------- */

test('the healthy list holds every feature page without a problem and links each to its page', () => {
  const snapshot = patch(controlRouteSnapshot(), 'quiz_channel', { exists: false });
  const healthy = healthyFeatures(snapshot);
  assert.equal(healthy.length, Object.keys(FEATURE_RESOURCE_KEYS_BY_PAGE).length - 1);
  assert.equal(healthy.some(item => item.path === QUIZZES), false, 'a feature with a problem is not listed as healthy');
  const markup = overviewPageMarkup({ snapshot, ...UTC });
  assert.match(markup, />11 features running normally<svg/);
  assert.match(markup, /data-disclosure="overview-healthy" data-open="false"/);
  assert.match(markup, /aria-expanded="false" aria-controls="control-disclosure-overview-healthy"/);
  assert.equal((markup.match(/class="overview-feature"/g) || []).length, 11);
  for (const item of healthy) assert.ok(markup.includes(`href="${item.path}" data-overview-link="${item.path}"`), item.path);
  assert.ok(healthy.every(item => destinationForPath(item.path)?.label === item.label));
});

test('each healthy feature shows a one-line summary derived from the snapshot', () => {
  const snapshot = controlRouteSnapshot();
  const expected = {
    '/control/community/reputation': '3 tiers, 50 to 500 points',
    [QUIZZES]: '2 questions, every 24 hours',
    '/control/community/voice-coworking': 'Rooms from Create Voice',
    '/control/community/showcase': 'Spotlights in #Showcase',
    '/control/utilities/notification-roles': '2 role buttons',
    '/control/content/feeds': '2 sources',
    '/control/content/announcements': 'Posts to #announcements',
    '/control/content/live': 'Posts to #live',
    '/control/utilities/ticket-configuration': '1 ticket type',
    '/control/utilities/anonymous-questions': 'Questions go to #anonymous-questions',
    '/control/workflows/moderation': 'Logs to #moderation-log',
    '/control/analytics': 'Weekly report to #weekly-analytics',
  };
  for (const [path, summary] of Object.entries(expected)) assert.equal(featureSummary(path, snapshot), summary, path);
  snapshot.ai_sources = [];
  assert.equal(featureSummary('/control/content/feeds', snapshot), 'No sources yet');
});

test('a summary the snapshot cannot support is left out, and a feature that is off says Off', () => {
  const snapshot = controlRouteSnapshot();
  delete snapshot.notification_panel;
  snapshot.features.find(item => item.name === 'reputation').enabled = false;
  assert.equal(featureSummary('/control/utilities/notification-roles', snapshot), '');
  assert.equal(featureSummary('/control/community/reputation', snapshot), 'Off');
  const markup = overviewPageMarkup({ snapshot, ...UTC });
  assert.doesNotMatch(markup, /href="\/control\/utilities\/notification-roles"[^>]*><span class="overview-feature-name">Notification roles<\/span><span/);
  assert.match(markup, />11 features running normally<svg/, 'a feature that is off does not count as running');
});

test('no markup repeats a status chip, a dot pill or an uppercase label', () => {
  const markup = overviewPageMarkup({ snapshot: patch(controlRouteSnapshot(), 'quiz_channel', { exists: false }), ...UTC });
  assert.doesNotMatch(markup, /control-chip|status-dot|control-context-status|control-resource-status/);
  assert.doesNotMatch(read('control-features.css').match(/\/\* Overview \*\/[\s\S]*$/)[0], /uppercase|letter-spacing:\s*\.0/);
});

/* ---------- Routing and shell ---------- */

test('Overview is the default landing, remembered routes still win, and the sidebar lists it first', () => {
  assert.equal(OVERVIEW_PATH, '/control/overview');
  assert.equal(resolveControlRoute('/control', null).path, OVERVIEW_PATH);
  assert.equal(resolveControlRoute('/control/overview', '/control/analytics').path, OVERVIEW_PATH);
  assert.equal(resolveControlRoute('/control', '/control/analytics').path, '/control/analytics');
  for (const file of ['control.html', 'commands.html', 'index.html']) {
    const html = read(file);
    const nav = html.slice(html.indexOf('<nav id="controlNavContent"'));
    assert.ok(nav.indexOf('data-nav-key="overview"') < nav.indexOf('data-domain-select="engagement"'), `${file} lists Overview before the groups`);
  }
});

test('the house icon is the Phosphor regular path', () => {
  assert.equal(hasControlIcon('house'), true);
  assert.match(controlIcon('house'), /viewBox="0 0 256 256"/);
  assert.match(controlIcon('house'), /M219\.31,108\.68l-80-80/);
});

test('the app renders Overview, routes its buttons and focuses the broken control after the entrance', () => {
  const app = read('control-app.js');
  assert.match(app, /from '\.\/control-overview\.js\?v=\d+'/);
  assert.match(app, /pageKey === OVERVIEW_PATH && session\?\.authenticated/);
  assert.match(app, /event\.target\.closest\?\.\('\[data-overview-link\]'\)/);
  assert.match(app, /navigate\(overviewLink\.dataset\.overviewLink, \{ focus: overviewLink\.dataset\.overviewFocus \|\| '' \}\)/);
  assert.match(app, /pendingFocus = focus;\s*renderMain\(\{ entrance: true \}\)/);
  assert.match(app, /if \(entrance && pendingFocus\) \{[\s\S]*?target\.focus\(\);/);
  assert.match(app, /const clientRedirect = controlRedirectFor\(location\.pathname\);/);
  assert.match(app, /location\.replace\(clientRedirect\)/);
});

test('a deleted live channel is a redirect to announcements, not a failure', async () => {
  const { problemsFromSnapshot } = await import('../docs-site/control-problems.js');
  const snapshot = {
    features: [{ name: 'live_announcements', enabled: true }],
    resources: [
      { key: 'live_announcements', id: '9', exists: false, kind: 'channel', name: null },
      { key: 'announcements', id: '8', exists: true, kind: 'text', name: 'news' },
      { key: 'live_ping_role', id: '7', exists: true, kind: 'role', name: 'Live' },
    ],
    channels: [{ id: '8', send_messages: true }],
  };
  const live = problemsFromSnapshot(snapshot).filter(p => p.path === '/control/content/live');
  assert.equal(live.length, 1);
  assert.equal(live[0].title, 'Live notices post to #news');
  assert.equal(live[0].effect, 'Live notices post to #news instead.');
  snapshot.resources[1].exists = false;
  assert.equal(problemsFromSnapshot(snapshot).find(p => p.resourceKey === 'live_announcements').effect, "Live notices can't post.");
});
