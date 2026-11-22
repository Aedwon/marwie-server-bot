import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

import {
  disclosure,
  isDisclosureOpen,
  masterSwitchRow,
  numberWithUnit,
  problemLine,
  savedRowKeys,
  settingRow,
  settingsRows,
  toggleDisclosure,
} from '../docs-site/control-components.js?v=24';
import { problemPaths, problemSentence, problemsFromSnapshot } from '../docs-site/control-problems.js?v=1';
import { navigationModel } from '../docs-site/control-navigation.js';
import { createControlStateStore } from '../docs-site/control-state.js';
import { createCommunityPageDefinition } from '../docs-site/control-community.js?v=22';
import { featureResourceKeys } from '../docs-site/control-resource-contract.js';
import { withResourceBindings } from '../docs-site/control-resource-bindings.js?v=2';
import { controlRouteSnapshot } from './fixtures/control-route-snapshot.js';

const REPUTATION = '/control/community/reputation';
const QUIZZES = '/control/community/quizzes';
const VOICE = '/control/community/voice-coworking';
const SHOWCASE = '/control/community/showcase';
const read = name => readFileSync(new URL(`../docs-site/${name}`, import.meta.url), 'utf8');

function resource(snapshot, key, patch) {
  const row = snapshot.resources.find(item => item.key === key);
  Object.assign(row, patch);
  return snapshot;
}

/* ---------- Problems model ---------- */

test('a healthy snapshot has no problems', () => {
  assert.deepEqual(problemsFromSnapshot(controlRouteSnapshot()), []);
  assert.deepEqual(problemsFromSnapshot(null), []);
  assert.equal(problemPaths([]).size, 0);
});

test('a deleted bound channel is a problem on the page that owns it', () => {
  const snapshot = resource(controlRouteSnapshot(), 'quiz_channel', { exists: false });
  const problems = problemsFromSnapshot(snapshot);
  assert.deepEqual(problems, [{
    pageKey: QUIZZES,
    path: QUIZZES,
    resourceKey: 'quiz_channel',
    title: "Quizzes can't post",
    cause: 'Deleted in Discord.',
    effect: "Quizzes can't post.",
  }]);
  assert.equal(problemSentence(problems[0]), "Deleted in Discord. Quizzes can't post.");
  assert.deepEqual([...problemPaths(problems)], [QUIZZES]);
});

test('a missing required binding is a problem and an optional one is not', () => {
  const snapshot = controlRouteSnapshot();
  resource(snapshot, 'builder_role', { id: null, name: '', exists: false });
  resource(snapshot, 'live_ping_role', { id: null, name: '', exists: false });
  resource(snapshot, 'coworking_lounge', { id: null, name: '', exists: false });
  const problems = problemsFromSnapshot(snapshot);
  assert.deepEqual(problems.map(problem => [problem.resourceKey, problem.cause]), [['builder_role', 'Not connected.']]);
  assert.equal(problems[0].pageKey, REPUTATION);
});

test('problems on a feature that is switched off are not reported', () => {
  const snapshot = resource(controlRouteSnapshot(), 'quiz_channel', { exists: false });
  snapshot.features.find(item => item.name === 'quizzes').enabled = false;
  assert.deepEqual(problemsFromSnapshot(snapshot), []);
});

test('Rob-bot missing Send Messages on a bound text channel is a problem, a voice channel is not', () => {
  const snapshot = controlRouteSnapshot();
  snapshot.channels.find(channel => channel.id === '210').send_messages = false;
  const problems = problemsFromSnapshot(snapshot);
  assert.deepEqual(problems.map(problem => [problem.pageKey, problem.cause]), [[QUIZZES, "Rob-bot can't send messages there."]]);
  // The fixture's voice channel reports send_messages false and must stay healthy.
  assert.equal(problems.some(problem => problem.resourceKey === 'create_workspace_voice'), false);
});

test('problem paths flag the owning navigation destination and its group', () => {
  const snapshot = resource(controlRouteSnapshot(), 'quiz_channel', { exists: false });
  const model = navigationModel({ path: '/control' }, 'engagement', {}, { flags: problemPaths(problemsFromSnapshot(snapshot)) });
  const group = model.items.find(item => item.type === 'group' && item.children.some(child => child.path === QUIZZES));
  assert.equal(group.flagged, true);
  assert.deepEqual(group.children.filter(child => child.flagged).map(child => child.path), [QUIZZES]);
});

test('the app feeds problem paths to the navigation flags', () => {
  const app = read('control-app.js');
  assert.match(app, /from '\.\/control-problems\.js\?v=1'/);
  assert.match(app, /problemPaths\(problemsFromSnapshot\(guildState\)\)/);
  assert.match(app, /shellController\.setFlags\(paths\)/);
  assert.match(read('control-shell.js'), /const setFlags = paths =>/);
});

/* ---------- Component markup ---------- */

test('setting row puts label and hint left and one control in the control column', () => {
  const markup = settingRow({ label: 'Posts every', hint: 'Between 1 and 720 hours.', control: '<input id="x">', controlId: 'x', rowKey: 'interval' });
  assert.match(markup, /<label class="control-setting-label" for="x">Posts every<\/label>/);
  assert.match(markup, /<p class="control-setting-hint">Between 1 and 720 hours\.<\/p>/);
  assert.match(markup, /data-row-key="interval"/);
  assert.match(markup, /<div class="control-setting-control"><input id="x"><\/div>/);
  assert.doesNotMatch(markup, /data-problem/);
});

test('a problem replaces the hint and marks the row with data-problem', () => {
  const markup = settingRow({ label: 'Quiz channel', hint: 'Hint text', problem: "Deleted in Discord. Quizzes can't post." });
  assert.match(markup, /data-problem/);
  assert.doesNotMatch(markup, /Hint text/);
  assert.match(markup, /<p class="control-problem"><svg[^>]*>.*<\/svg><span>Deleted in Discord\. Quizzes can&#39;t post\.<\/span><\/p>/s);
  assert.doesNotMatch(problemLine('Nope'), /role=/);
  assert.equal(problemLine(''), '');
});

test('master switch row is a labelled switch whose hint states the effect when off', () => {
  const off = masterSwitchRow({ label: 'Award reputation', offHint: 'Members keep their points.', hint: 'Shown when on.', checked: false, field: 'enabled' });
  assert.match(off, /data-master-row/);
  assert.match(off, /<input type="checkbox" role="switch" id="(control-master-\d+)" data-setting-field="enabled">/);
  assert.match(off, /for="control-master-\d+">Award reputation<\/label>/);
  assert.match(off, /Members keep their points\./);
  assert.doesNotMatch(off, /Shown when on/);
  const on = masterSwitchRow({ label: 'Award reputation', offHint: 'Members keep their points.', checked: true, field: 'enabled' });
  assert.match(on, /role="switch"[^>]* checked/);
  assert.doesNotMatch(on, /control-setting-hint/, 'a healthy state says nothing');
  assert.match(masterSwitchRow({ label: 'x', field: 'f', attribute: 'data-community-field' }), /data-community-field="f"/);
});

test('number input shows its unit after a bordered input', () => {
  const markup = numberWithUnit({ id: 'n', value: 50, unit: 'pts', min: 1, max: 100, attributes: 'data-x="1"' });
  // A numeric text input keeps caret position across re-renders; the unit sits inside the bordered box.
  assert.match(markup, /<span class="control-number"><input class="control-number-input" type="text" inputmode="numeric" pattern="\[0-9\]\*"[^>]*data-min="1" data-max="100"[^>]*id="n"[^>]*data-x="1" value="50"><span class="control-unit">pts<\/span><\/span>/);
  const css = read('control-features.css');
  assert.match(css, /\.control-number \{[^}]*border: 1px solid var\(--stroke-field\)/);
  assert.match(css, /\.control-number:focus-within \{ border-color: var\(--focus-ring\)/);
  assert.match(css, /::-webkit-inner-spin-button/);
});

test('settings rows sit in a container that carries the 240px control column', () => {
  assert.match(settingsRows('<i></i>', { label: 'Group' }), /^<div class="control-settings-rows" data-settings-rows role="group" aria-label="Group"><i><\/i><\/div>$/);
  assert.match(read('control-features.css'), /grid-template-columns: minmax\(0, 1fr\) 240px;/);
  assert.match(read('control-features.css'), /min-height: 52px;/);
});

test('disclosure is a button with a chevron, aria-expanded and aria-controls', () => {
  const closed = disclosure({ id: 'detail', label: 'More', body: '<p>Body</p>', open: false });
  assert.match(closed, /<button type="button" class="control-disclose" data-disclosure-toggle aria-expanded="false" aria-controls="control-disclosure-detail">More<svg/);
  assert.match(closed, /id="control-disclosure-detail"><div inert data-disclosure-body><p>Body<\/p><\/div>/);
  const open = disclosure({ id: 'detail', label: 'More', body: '', open: true });
  assert.match(open, /aria-expanded="true"/);
  assert.doesNotMatch(open, /inert/);
});

test('toggling a disclosure flips its state and remembers it across renders', () => {
  const body = { inert: true };
  const container = { dataset: { open: 'false', disclosure: 'toggle-test' }, querySelector: () => body };
  const attributes = {};
  const button = { closest: () => container, setAttribute: (name, value) => { attributes[name] = value; } };
  assert.equal(toggleDisclosure(button), true);
  assert.equal(container.dataset.open, 'true');
  assert.equal(attributes['aria-expanded'], 'true');
  assert.equal(body.inert, false);
  assert.equal(isDisclosureOpen('toggle-test'), true);
  assert.match(disclosure({ id: 'toggle-test', label: 'x' }), /aria-expanded="true"/);
  assert.equal(toggleDisclosure(button), false);
  assert.equal(isDisclosureOpen('toggle-test'), false);
});

test('no component or page markup draws a status dot or chip', () => {
  const markups = [
    masterSwitchRow({ label: 'a', field: 'f', checked: true }),
    settingRow({ label: 'a', problem: 'b' }),
    disclosure({ id: 'd', label: 'x', body: 'y' }),
  ];
  for (const markup of markups) assert.doesNotMatch(markup, /dot|pill|chip|badge/i);
  const css = read('control-features.css') + read('control.css');
  assert.doesNotMatch(css, /\.control-state-chip|\.community-state\b/);
});

test('no source file calls or defines stateChipMarkup', () => {
  for (const file of readdirSync(new URL('../docs-site/', import.meta.url)).filter(name => name.endsWith('.js'))) {
    assert.doesNotMatch(read(file), /stateChipMarkup|control-state-chip/, file);
  }
});

/* ---------- Converted Community pages ---------- */

function wired(pageKey, snapshot = controlRouteSnapshot()) {
  const definition = withResourceBindings(createCommunityPageDefinition(pageKey), featureResourceKeys(pageKey), { genericContext: 'never' });
  const store = createControlStateStore();
  store.register(definition);
  store.hydrate(pageKey, snapshot, 'a'.repeat(64));
  store.beginEdit(pageKey);
  const listeners = {};
  const root = { addEventListener: (type, handler) => { (listeners[type] ||= []).push(handler); }, removeEventListener() {} };
  const handlers = new Proxy({}, { get: (_target, type) => event => (listeners[type] || []).forEach(handler => handler(event)) });
  definition.install({ root, store, rerender() {}, onSave() {} });
  const render = () => definition.render({ state: store.get(pageKey), snapshot });
  return { definition, store, handlers, render, snapshot };
}

const field = (dataset, extra = {}) => ({ dataset, closest: () => null, ...extra });

test('every converted page renders without context, without Edit settings, with the master switch first', () => {
  for (const pageKey of [REPUTATION, QUIZZES, VOICE, SHOWCASE]) {
    const { definition, store, render, snapshot } = wired(pageKey);
    const markup = render();
    assert.equal(definition.renderContext({ state: store.get(pageKey), snapshot }), '', pageKey);
    assert.doesNotMatch(markup, /Edit settings|data-community-edit|control-state-chip|community-state/, pageKey);
    assert.equal((markup.match(/data-master-row/g) || []).length, 1, pageKey);
    assert.match(markup, /<h1>/);
    assert.ok(markup.indexOf('data-master-row') < markup.indexOf('data-resource-select'), `${pageKey} master switch is the first row`);
    assert.match(markup, /class="[^"]*control-save-bar/);
    assert.doesNotMatch(markup, /role="alert"/, `${pageKey} shows save errors in the save bar only`);
  }
});

test('the master switch off dims the rows below and still updates the draft', () => {
  const { store, handlers, render } = wired(SHOWCASE);
  assert.match(render(), /data-master="on"/);
  handlers.change({ target: field({ communityField: 'enabled' }, { checked: false }) });
  assert.equal(store.get(SHOWCASE).draft.enabled, false);
  const markup = render();
  assert.match(markup, /data-master="off"/);
  assert.match(markup, /Members cannot post showcase threads\./);
  assert.match(markup, /<select class="control-select"[^>]*data-resource-select="showcase_forum"/, 'dimmed rows stay editable');
  assert.doesNotMatch(markup, /data-resource-select="showcase_forum"[^>]*disabled/);
  const css = read('control-features.css');
  assert.match(css, /\[data-master="off"\] :is\(\.control-setting-row:not\(\[data-master-row\]\), \.control-question\) \{ opacity: \.5; \}/);
});

test('a bound channel deleted in Discord shows one problem on its row and nowhere else on the page', () => {
  const snapshot = resource(controlRouteSnapshot(), 'quiz_channel', { exists: false });
  snapshot.channels = snapshot.channels.filter(channel => channel.id !== '210');
  const { render } = wired(QUIZZES, snapshot);
  const markup = render();
  assert.equal((markup.match(/Deleted in Discord\./g) || []).length, 1);
  assert.match(markup, /data-row-key="quiz_channel" data-problem/);
  assert.match(markup, /aria-invalid="true" data-invalid/);
  assert.match(markup, /<option value="" selected>Choose a channel<\/option>/);
});

test('resource selects show #name, @name and plain category names from the snapshot', () => {
  const quizzes = wired(QUIZZES).render();
  assert.match(quizzes, /<option value="210" selected>#quiz<\/option>/);
  const reputation = wired(REPUTATION, (() => {
    const snapshot = controlRouteSnapshot();
    snapshot.roles = [{ id: '201', name: 'Builder', managed: false, position: 1 }];
    return snapshot;
  })()).render();
  assert.match(reputation, /<option value="201" selected>@Builder<\/option>/);
  assert.match(reputation, /Choose a role|<option value="201"/);
});

test('a resource change merges into the draft through the page root', () => {
  const { store, handlers } = wired(QUIZZES);
  const select = { dataset: { resourceSelect: 'quiz_channel' }, value: '' };
  handlers.change({ target: { closest: selector => (selector === '[data-resource-select]' ? select : null) } });
  assert.equal(store.get(QUIZZES).draft.resourceBindings.quiz_channel, null);
  assert.deepEqual(store.buildSaveRequest(QUIZZES).changes, [{ action_type: 'clear_resource', payload: { key: 'quiz_channel' } }]);
});

test('Quizzes question rows show prompt and rotation as plain muted text and disclose their fields', () => {
  const { render } = wired(QUIZZES);
  const markup = render();
  assert.match(markup, /<span class="control-question-prompt">What does len return\?<\/span><span class="control-question-status">In rotation<\/span>/);
  assert.match(markup, /<span class="control-question-status">Paused<\/span>/);
  assert.match(markup, /data-disclosure="quiz-q-7" data-open="false"/);
  assert.match(markup, /aria-controls="control-disclosure-quiz-q-7"/);
  assert.doesNotMatch(markup, /control-question-status"[^>]*data-tone/);
});

test('Add question appends an expanded new question', () => {
  const { store, handlers, render } = wired(QUIZZES);
  const before = store.get(QUIZZES).draft.questions.length;
  handlers.click({ target: { closest: selector => (selector === '[data-community-add-question]' ? {} : null) } });
  assert.equal(store.get(QUIZZES).draft.questions.length, before + 1);
  const markup = render();
  assert.match(markup, new RegExp(`data-disclosure="quiz-q-new-${before}" data-open="true"`));
  assert.match(markup, /Remove draft/);
});

/* ---------- Save request equality ---------- */

test('Reputation builds the same page save request for the same edits', () => {
  const { store, handlers } = wired(REPUTATION);
  handlers.change({ target: field({ communityField: 'enabled' }, { checked: false }) });
  handlers.change({ target: field({ communityThreshold: 'builder' }, { value: '60' }) });
  handlers.change({ target: field({ communityThreshold: 'mentor' }, { value: '600' }) });
  assert.equal(JSON.stringify(store.buildSaveRequest(REPUTATION)), JSON.stringify({
    page_key: REPUTATION,
    base_revision: 'a'.repeat(64),
    changes: [
      { action_type: 'set_feature', payload: { feature: 'reputation', enabled: false } },
      { action_type: 'set_reputation_thresholds', payload: { builder: 60, contributor: 150, mentor: 600 } },
    ],
  }));
});

test('Quizzes builds the same page save request for the same edits', () => {
  const { store, handlers } = wired(QUIZZES);
  handlers.change({ target: field({ communityField: 'intervalHours' }, { value: '12' }) });
  const card = { dataset: { questionIndex: '0' } };
  const inCard = (dataset, extra) => ({ dataset, closest: selector => (selector === '[data-question-index]' ? card : null), ...extra });
  handlers.change({ target: inCard({ questionField: 'prompt' }, { value: 'What does len() return?' }) });
  handlers.change({ target: inCard({ questionField: 'enabled' }, { checked: false }) });
  handlers.click({ target: { closest: selector => (selector === '[data-community-add-question]' ? {} : null) } });
  const added = { dataset: { questionIndex: '2' } };
  const inAdded = (dataset, extra) => ({ dataset, closest: selector => (selector === '[data-question-index]' ? added : null), ...extra });
  handlers.change({ target: inAdded({ questionField: 'category' }, { value: 'Discord' }) });
  handlers.change({ target: inAdded({ questionField: 'prompt' }, { value: 'Which permission kicks?' }) });
  ['Kick Members', 'Ban Members', 'Manage Roles', 'View Audit Log'].forEach((option, index) => {
    handlers.change({ target: inAdded({ questionOption: String(index) }, { value: option }) });
  });
  assert.equal(JSON.stringify(store.buildSaveRequest(QUIZZES)), JSON.stringify({
    page_key: QUIZZES,
    base_revision: 'a'.repeat(64),
    changes: [
      { action_type: 'set_quiz_schedule', payload: { interval_hours: 12 } },
      {
        action_type: 'update_quiz_question',
        payload: {
          category: 'Python',
          prompt: 'What does len() return?',
          options: ['A count', 'A string', 'A bool', 'None'],
          correct: 1,
          explanation: 'It returns an integer count.',
          question_id: 7,
        },
      },
      { action_type: 'set_quiz_question_enabled', payload: { question_id: 7, enabled: false } },
      {
        action_type: 'add_quiz_question',
        payload: {
          category: 'Discord',
          prompt: 'Which permission kicks?',
          options: ['Kick Members', 'Ban Members', 'Manage Roles', 'View Audit Log'],
          correct: 1,
          explanation: '',
        },
      },
    ],
  }));
});

/* ---------- Store, saved tint, versions ---------- */

test('a saved outcome and a discard keep the page in edit state', () => {
  const { store } = wired(SHOWCASE);
  store.updateDraft(SHOWCASE, draft => { draft.enabled = false; });
  store.discard(SHOWCASE);
  assert.equal(store.get(SHOWCASE).mode, 'edit');
  store.updateDraft(SHOWCASE, draft => { draft.enabled = false; });
  const snapshot = controlRouteSnapshot();
  snapshot.features.find(item => item.name === 'showcase').enabled = false;
  store.reconcile(SHOWCASE, { outcome: 'saved' }, snapshot, 'b'.repeat(64));
  assert.equal(store.get(SHOWCASE).mode, 'edit');
  assert.equal(store.get(SHOWCASE).status, 'saved');
});

test('registered converted pages enter edit state when hydrated', () => {
  const registry = read('control-page-registry.js');
  assert.match(registry, /definition\.editOnMount && controlState\.get\(pageKey\)\.mode !== 'edit'/);
  assert.equal(createCommunityPageDefinition(REPUTATION).editOnMount, true);
});

test('saved rows are derived from the save request and tinted once for 500ms', () => {
  assert.deepEqual(savedRowKeys([
    { action_type: 'set_feature', payload: { feature: 'quizzes', enabled: false } },
    { action_type: 'set_resource', payload: { key: 'quiz_channel', discord_id: '1' } },
    { action_type: 'set_quiz_schedule', payload: { interval_hours: 12 } },
    { action_type: 'set_quiz_question_enabled', payload: { question_id: 7, enabled: false } },
  ]), ['master', 'quiz_channel', 'intervalHours', 'question:7']);
  assert.deepEqual(savedRowKeys([{ action_type: 'set_reputation_thresholds', payload: {} }]), ['threshold:builder', 'threshold:contributor', 'threshold:mentor']);
  assert.match(read('control-features.css'), /\.control-row-saved \{ animation: 500ms var\(--ease-out\) both control-row-saved; \}/);
  const app = read('control-app.js');
  assert.match(app, /renderMain\(\{ savedRows: saved \? savedRowKeys\(request\.changes\) : \[\] \}\)/);
  assert.match(app, /classList\.add\('control-row-saved'\)/);
});

test('changed imports carry bumped versions', () => {
  const app = read('control-app.js');
  assert.match(app, /control-components\.js\?v=24/);
  assert.match(app, /control-community\.js\?v=22/);
  assert.match(read('control-community.js'), /control-resource-bindings\.js\?v=2/);
  assert.match(read('control.html'), /control-features\.css\?v=20/);
});
