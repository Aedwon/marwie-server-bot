const health = [
  ['Rob-bot', 'Online', 'Mock status'],
  ['Discord', 'Connected', 'OAuth later'],
  ['Database', 'Neon ready', 'Not wired'],
  ['Permissions', 'No blockers', 'Mock audit'],
];

const resourceGroups = [
  {
    name: 'Logs',
    items: [
      ['moderation_log', 'Moderation log', 'channel', '#moderation-log', 'Connected'],
      ['message_log', 'Message log', 'channel', '#bot-logs', 'Connected'],
      ['bot_log', 'Bot log', 'channel', '#bot-logs', 'Connected'],
    ],
  },
  {
    name: 'Tickets',
    items: [
      ['ticket_panel', 'Ticket panel', 'channel', '#tickets', 'Connected'],
      ['ticket_category', 'Ticket category', 'category', 'TICKETS', 'Connected'],
      ['ticket_logs', 'Ticket logs', 'channel', '#ticket-logs', 'Connected'],
    ],
  },
  {
    name: 'Voice & coworking',
    items: [
      ['create_workspace_voice', 'Create workspace', 'voice', 'Create Workspace', 'Connected'],
      ['temp_voice_category', 'Workspace category', 'category', 'WORKSPACES', 'Connected'],
      ['coworking_lounge', 'Coworking lounge', 'voice', 'Coworking Lounge', 'Connected'],
    ],
  },
  {
    name: 'Announcements & roles',
    items: [
      ['announcements', 'Announcements', 'channel', '#announcements', 'Connected'],
      ['live_announcements', 'Live announcements', 'channel', '#live', 'Connected'],
      ['live_ping_role', 'Live ping role', 'role', 'Live Notifications', 'Connected'],
      ['role_panel', 'Role panel', 'channel', '#roles', 'Connected'],
    ],
  },
  {
    name: 'Community workflows',
    items: [
      ['ai_updates', 'AI updates', 'channel', '#ai-updates', 'Connected'],
      ['build_help_forum', 'Build-help forum', 'forum', '#general-questions', 'Review'],
      ['solved_tag', 'Solved tag', 'forum tag', 'Solved', 'Review'],
      ['quiz_channel', 'Quiz channel', 'channel', 'Not connected', 'Missing'],
      ['anon_questions', 'Anonymous questions', 'channel', '#anonymous-questions', 'Connected'],
      ['analytics', 'Analytics', 'channel', 'Not connected', 'Missing'],
      ['showcase_forum', 'Showcase forum', 'forum', '#showcase', 'Connected'],
      ['app_of_the_week', 'App of the Week', 'channel', '#app-of-the-week', 'Connected'],
      ['collab_lfg', 'Collaboration / LFG', 'channel', '#collab-lfg', 'Connected'],
    ],
  },
  {
    name: 'Reputation roles',
    items: [
      ['builder_role', 'Builder', 'role', 'Builder', 'Connected'],
      ['contributor_role', 'Contributor', 'role', 'Contributor', 'Connected'],
      ['mentor_role', 'Mentor', 'role', 'Mentor', 'Connected'],
    ],
  },
];

const features = [
  ['moderation', 'Moderation', 'Cases, warnings, timeouts, kicks and bans.'],
  ['message_logs', 'Message logs', 'Edited/deleted message mirroring and exclusions.'],
  ['tickets', 'Tickets', 'Member ticket panel and staff controls.'],
  ['voice', 'Voice workspaces', 'Temporary member workspaces and cleanup.'],
  ['announcements', 'Announcements', 'Staff announcement composer.'],
  ['live_announcements', 'Live announcements', 'Mar Wie TikTok Live notices.'],
  ['reputation', 'Reputation', 'Activity points and tier roles.'],
  ['build_help', 'Build-help', 'Solved answers and unanswered-thread surfacing.'],
  ['quizzes', 'Quizzes', 'Question bank, sessions and scheduler.'],
  ['anonymous_questions', 'Anonymous Q&A', 'Public anonymous questions and audits.'],
  ['coworking', 'Coworking', 'Pomodoro and collaboration workflows.'],
  ['ai_updates', 'AI updates', 'RSS/Atom polling and posting.'],
  ['analytics', 'Analytics', 'Weekly staff activity report.'],
  ['showcase', 'Showcase', 'App of the Week workflow.'],
];

const exampleOptions = {
  channel: ['#moderation-log', '#bot-logs', '#tickets', '#ticket-logs', '#announcements', '#live', '#roles', '#ai-updates', '#quizzes', '#anonymous-questions', '#analytics', '#app-of-the-week', '#collab-lfg'],
  voice: ['Create Workspace', 'Coworking Lounge'],
  category: ['TICKETS', 'WORKSPACES', 'Support'],
  forum: ['#general-questions', '#build-help', '#showcase'],
  role: ['Live Notifications', 'Builder', 'Contributor', 'Mentor'],
  'forum tag': ['Solved', 'Answered'],
};

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function optionHtml(type, current) {
  const values = [...new Set([current, ...(exampleOptions[type] || [])])];
  if (!values.includes('Not connected')) values.push('Not connected');
  return values.map(value => `<option${value === current ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('');
}

function resourceGroupHtml(group) {
  const rows = group.items.map(([key, label, type, current, state]) => {
    const stateClass = state === 'Connected' ? 'good' : state === 'Review' ? 'warn' : '';
    return `<div class="resource-row" data-resource-key="${key}" data-initial="${escapeHtml(current)}" data-initial-state="${state}">
      <div class="resource-key"><b>${label}</b><small>${escapeHtml(type)} · <code>${key}</code></small></div>
      <select aria-label="${label}">${optionHtml(type, current)}</select>
      <span class="mapping-state ${stateClass}">${state}</span>
    </div>`;
  }).join('');
  return `<section class="resource-group"><h3>${group.name}</h3>${rows}</section>`;
}

function featureHtml([key, label, description]) {
  return `<div class="feature-row" data-feature-key="${key}">
    <div><b>${label}</b><small>${description}</small></div>
    <label class="switch" title="Prototype toggle"><input type="checkbox" checked data-initial-checked="true" aria-label="${label}"><span></span></label>
  </div>`;
}

function healthHtml([label, value, note]) {
  return `<div class="health-chip"><span>${label}</span><b>${value}</b><small>${note}</small></div>`;
}

const healthStrip = document.querySelector('#healthStrip');
const resourceRoot = document.querySelector('#resourceGroups');
const featureRoot = document.querySelector('#featureList');
if (healthStrip) healthStrip.innerHTML = health.map(healthHtml).join('');
if (resourceRoot) resourceRoot.innerHTML = resourceGroups.map(resourceGroupHtml).join('');
if (featureRoot) featureRoot.innerHTML = features.map(featureHtml).join('');

const renderedResources = document.querySelectorAll('[data-resource-key]').length;
const renderedFeatures = document.querySelectorAll('[data-feature-key]').length;
const resourceCount = document.querySelector('#resourceCount');
if (resourceCount) resourceCount.textContent = `${renderedResources} mappings`;
if (renderedResources !== 25) console.error(`Control prototype expected 25 resource mappings; found ${renderedResources}.`);
if (renderedFeatures !== 14) console.error(`Control prototype expected 14 feature switches; found ${renderedFeatures}.`);

function setButtonReady(button, ready) {
  if (!button) return;
  button.disabled = !ready;
  button.classList.toggle('is-ready', ready);
}

function setText(node, value) {
  if (node) node.textContent = value;
}

function valueChanged(control) {
  return control.dataset.initialValue !== undefined && control.value !== control.dataset.initialValue;
}

function rememberValue(control) {
  if (control && control.dataset.initialValue === undefined) control.dataset.initialValue = control.value;
}

const rolePanelBtn = document.querySelector('#rolePanelBtn');
function updateRolePanelAction() {
  const panel = document.querySelector('[data-resource-key="role_panel"] select');
  const role = document.querySelector('[data-resource-key="live_ping_role"] select');
  if (!panel || !role) return;
  const valid = panel.value !== 'Not connected' && role.value !== 'Not connected';
  const dirty = panel.value !== panel.closest('.resource-row').dataset.initial || role.value !== role.closest('.resource-row').dataset.initial;
  setButtonReady(rolePanelBtn, valid && dirty);
}

document.querySelectorAll('.resource-row').forEach(row => {
  const select = row.querySelector('select');
  const state = row.querySelector('.mapping-state');
  if (!select || !state) return;
  select.addEventListener('change', () => {
    const changed = select.value !== row.dataset.initial;
    row.classList.toggle('is-changed', changed);
    state.className = 'mapping-state';
    if (changed) {
      state.classList.add('changed');
      state.textContent = 'Changed';
    } else {
      const initialState = row.dataset.initialState || '';
      state.textContent = initialState;
      if (initialState === 'Connected') state.classList.add('good');
      if (initialState === 'Review') state.classList.add('warn');
    }
    updateRolePanelAction();
  });
});
updateRolePanelAction();

document.querySelectorAll('.feature-row input[type="checkbox"]').forEach(input => {
  input.addEventListener('change', () => {
    const row = input.closest('.feature-row');
    const changed = input.checked !== (input.dataset.initialChecked === 'true');
    row?.classList.toggle('is-changed', changed);
  });
});

const thresholdInputs = ['#builderThreshold', '#contributorThreshold', '#mentorThreshold']
  .map(selector => document.querySelector(selector))
  .filter(Boolean);
thresholdInputs.forEach(rememberValue);
const thresholdSaveBtn = document.querySelector('#thresholdSaveBtn');
const thresholdStatus = document.querySelector('#thresholdStatus');
function updateThresholds() {
  const values = thresholdInputs.map(input => Number(input.value));
  const valid = values.every(value => Number.isFinite(value) && value >= 1 && value <= 100000)
    && values[0] < values[1]
    && values[1] < values[2];
  const dirty = thresholdInputs.some(valueChanged);
  if (!valid) setText(thresholdStatus, 'Use increasing values: Builder < Contributor < Mentor.');
  else if (dirty) setText(thresholdStatus, 'Thresholds changed.');
  else setText(thresholdStatus, 'No changes');
  setButtonReady(thresholdSaveBtn, valid && dirty);
}
thresholdInputs.forEach(input => input.addEventListener('input', updateThresholds));
updateThresholds();

const repMember = document.querySelector('#repMember');
const repPoints = document.querySelector('#repPoints');
const repReason = document.querySelector('#repReason');
const repReviewBtn = document.querySelector('#repReviewBtn');
const repStatus = document.querySelector('#repStatus');
function updateReputationAdjustment() {
  const points = Number(repPoints?.value || 0);
  const valid = Boolean(repMember?.value)
    && Number.isFinite(points)
    && points >= -1000
    && points <= 1000
    && points !== 0
    && Boolean(repReason?.value.trim());
  setText(repStatus, valid ? 'Ready to review.' : 'Select a member, non-zero points and a reason.');
  setButtonReady(repReviewBtn, valid);
}
[repMember, repPoints, repReason].forEach(control => control?.addEventListener('input', updateReputationAdjustment));
[repMember, repPoints, repReason].forEach(control => control?.addEventListener('change', updateReputationAdjustment));
updateReputationAdjustment();

const quizInterval = document.querySelector('#quizInterval');
const quizScheduleBtn = document.querySelector('#quizScheduleBtn');
rememberValue(quizInterval);
function updateQuizSchedule() {
  const value = Number(quizInterval?.value || 0);
  setButtonReady(quizScheduleBtn, valueChanged(quizInterval) && value >= 1 && value <= 720);
}
quizInterval?.addEventListener('input', updateQuizSchedule);
updateQuizSchedule();

const quizFields = {
  category: document.querySelector('#quizCategory'),
  prompt: document.querySelector('#quizPrompt'),
  a: document.querySelector('#quizA'),
  b: document.querySelector('#quizB'),
  c: document.querySelector('#quizC'),
  d: document.querySelector('#quizD'),
};
const quizQuestionBtn = document.querySelector('#quizQuestionBtn');
const quizQuestionStatus = document.querySelector('#quizQuestionStatus');
function updateQuizQuestion() {
  const valid = Object.values(quizFields).every(field => Boolean(field?.value.trim()));
  setText(quizQuestionStatus, valid ? 'Ready to review.' : 'Complete the prompt and all four options.');
  setButtonReady(quizQuestionBtn, valid);
}
Object.values(quizFields).forEach(field => field?.addEventListener('input', updateQuizQuestion));
updateQuizQuestion();

const feedName = document.querySelector('#feedName');
const feedCategory = document.querySelector('#feedCategory');
const feedUrl = document.querySelector('#feedUrl');
const feedAddBtn = document.querySelector('#feedAddBtn');
const feedStatus = document.querySelector('#feedStatus');
function updateFeedSource() {
  const url = feedUrl?.value.trim() || '';
  const validUrl = /^https?:\/\/[^\s]+$/i.test(url);
  const valid = Boolean(feedName?.value.trim()) && Boolean(feedCategory?.value.trim()) && validUrl;
  if (!feedName?.value.trim() || !feedCategory?.value.trim() || !url) setText(feedStatus, 'Name, category and URL required.');
  else if (!validUrl) setText(feedStatus, 'Use an HTTP or HTTPS URL.');
  else setText(feedStatus, 'Ready to add.');
  setButtonReady(feedAddBtn, valid);
}
[feedName, feedCategory, feedUrl].forEach(field => field?.addEventListener('input', updateFeedSource));
updateFeedSource();

const announcement = {
  channel: document.querySelector('#announcementChannel'),
  title: document.querySelector('#announcementTitle'),
  body: document.querySelector('#announcementBody'),
  footer: document.querySelector('#announcementFooter'),
  color: document.querySelector('#announcementColor'),
};
const announcementReviewBtn = document.querySelector('#announcementReviewBtn');
const announcementStatus = document.querySelector('#announcementStatus');
const announcementEmbed = document.querySelector('#announcementEmbed');
function updateAnnouncementPreview() {
  const rawColor = announcement.color?.value.trim().replace(/^#/, '') || '';
  const validColor = /^[0-9a-f]{6}$/i.test(rawColor);
  const body = announcement.body?.value.trim() || '';
  const title = announcement.title?.value.trim() || '';
  const footer = announcement.footer?.value.trim() || '';
  setText(document.querySelector('#announcementPreviewChannel'), announcement.channel?.value || '#announcements');
  const titleNode = document.querySelector('#announcementPreviewTitle');
  const footerNode = document.querySelector('#announcementPreviewFooter');
  setText(titleNode, title);
  if (titleNode) titleNode.hidden = !title;
  setText(document.querySelector('#announcementPreviewBody'), body || 'Your announcement will appear here.');
  setText(footerNode, footer);
  if (footerNode) footerNode.hidden = !footer;
  if (announcementEmbed && validColor) announcementEmbed.style.setProperty('--embed-accent', `#${rawColor}`);
  if (!validColor) setText(announcementStatus, 'Use a six-digit hex color.');
  else if (!body) setText(announcementStatus, 'Write a body to review.');
  else setText(announcementStatus, 'Ready to review.');
  setButtonReady(announcementReviewBtn, Boolean(body) && validColor);
}
Object.values(announcement).forEach(field => {
  field?.addEventListener('input', updateAnnouncementPreview);
  field?.addEventListener('change', updateAnnouncementPreview);
});
updateAnnouncementPreview();

const live = {
  destination: document.querySelector('#liveDestination'),
  ping: document.querySelector('#livePing'),
  topic: document.querySelector('#liveTopic'),
};
Object.values(live).forEach(rememberValue);
const liveReviewBtn = document.querySelector('#liveReviewBtn');
const liveStatus = document.querySelector('#liveStatus');
function updateLivePreview() {
  setText(document.querySelector('#livePreviewChannel'), live.destination?.value || '#live');
  const pingNode = document.querySelector('#livePreviewPing');
  const pingValue = live.ping?.value || 'None';
  setText(pingNode, pingValue === 'None' ? '' : `@${pingValue}`);
  if (pingNode) pingNode.hidden = pingValue === 'None';
  setText(document.querySelector('#livePreviewTopic'), live.topic?.value.trim() || 'Join the livestream.');
  const dirty = Object.values(live).some(valueChanged);
  setText(liveStatus, dirty ? 'Ready to review.' : 'Change a field to review.');
  setButtonReady(liveReviewBtn, dirty);
}
Object.values(live).forEach(field => {
  field?.addEventListener('input', updateLivePreview);
  field?.addEventListener('change', updateLivePreview);
});
updateLivePreview();

document.querySelectorAll('.value-chip[data-token]').forEach(chip => {
  chip.addEventListener('click', () => {
    chip.remove();
  });
});

const root = document.documentElement;
const themeButtons = [...document.querySelectorAll('[data-theme-choice]')];
const themeColor = document.querySelector('#themeColor');
const scheme = matchMedia('(prefers-color-scheme: dark)');

function applyTheme(pref) {
  const actual = pref === 'system' ? (scheme.matches ? 'dark' : 'light') : pref;
  root.dataset.preference = pref;
  root.dataset.theme = actual;
  themeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === pref)));
  localStorage.setItem('rob-doc-theme', pref);
  if (themeColor) themeColor.content = actual === 'dark' ? '#171719' : '#f5f5f7';
}

themeButtons.forEach(button => button.addEventListener('click', () => applyTheme(button.dataset.themeChoice)));
scheme.addEventListener?.('change', () => {
  if (root.dataset.preference === 'system') applyTheme('system');
});
applyTheme(root.dataset.preference || 'system');

const side = document.querySelector('#sidebar');
const menuBtn = document.querySelector('#menuBtn');
function closeMenu() {
  side?.classList.remove('open');
  menuBtn?.setAttribute('aria-expanded', 'false');
}
menuBtn?.addEventListener('click', () => {
  const open = side?.classList.toggle('open') || false;
  menuBtn.setAttribute('aria-expanded', String(open));
});
side?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  if (innerWidth <= 900) closeMenu();
}));
addEventListener('keydown', event => {
  if (event.key === 'Escape') closeMenu();
});

const navLinks = [...document.querySelectorAll('.control-nav a[href^="#"]')];
const navTargets = navLinks.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!visible) return;
    navLinks.forEach(link => link.setAttribute('aria-current', String(link.getAttribute('href') === `#${visible.target.id}`)));
  }, { rootMargin: '-8% 0px -78% 0px' });
  navTargets.forEach(target => observer.observe(target));
}

const dialog = document.querySelector('#prototypeDialog');
const dialogTitle = document.querySelector('#prototypeDialogTitle');
const dialogCopy = document.querySelector('#prototypeDialogCopy');
const actionCopy = {
  'Review setup': 'The live version will show the exact create/remap diff and require confirmation before Discord changes.',
  'Refresh role panel': 'The role-panel mappings changed. The live version would review the refresh before posting it.',
  'Review reputation adjustment': 'The live version will show member, point delta and reason before applying the adjustment.',
  'Save reputation thresholds': 'The live version will review the three threshold values before saving them.',
  'Save quiz question': 'The live version will review the question and answers before adding it to the bank.',
  'Save quiz schedule': 'The live version will review the new interval before updating the scheduler.',
  'Add AI source': 'The live version will validate and review the feed before saving it.',
  'Review announcement': 'The Discord output is visible beside the editor. The live version would add a final Send confirmation after this review.',
  'Review live announcement': 'The Discord output is visible beside the editor. The live version would add a final Send confirmation after this review.',
};

document.querySelectorAll('.prototype-action').forEach(button => {
  button.addEventListener('click', () => {
    if (button.disabled) return;
    const action = button.dataset.prototypeAction || button.textContent.trim();
    setText(dialogTitle, action);
    setText(dialogCopy, actionCopy[action] || 'Prototype only. No live change will be sent.');
    if (dialog?.showModal) dialog.showModal();
  });
});

// Prototype boundary: local DOM state only. No fetch(), WebSocket, OAuth, database client, or host API is used.
