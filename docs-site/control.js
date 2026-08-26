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
    return `<div class="resource-row" data-resource-key="${key}">
      <div class="resource-key"><b>${label}</b><small><code>${key}</code> · ${type}</small></div>
      <select aria-label="${label}">${optionHtml(type, current)}</select>
      <span class="mapping-state ${stateClass}">${state}</span>
    </div>`;
  }).join('');
  return `<section class="resource-group"><h3>${group.name}</h3>${rows}</section>`;
}

function featureHtml([key, label, description]) {
  return `<div class="feature-row" data-feature-key="${key}">
    <div><b>${label}</b><small>${description}</small></div>
    <label class="switch" title="Prototype toggle"><input type="checkbox" checked aria-label="${label}"><span></span></label>
  </div>`;
}

function healthHtml([label, value, note]) {
  return `<div class="health-chip"><span>${label}</span><b>${value}</b><small>${note}</small></div>`;
}

document.querySelector('#healthStrip').innerHTML = health.map(healthHtml).join('');
document.querySelector('#resourceGroups').innerHTML = resourceGroups.map(resourceGroupHtml).join('');
document.querySelector('#featureList').innerHTML = features.map(featureHtml).join('');

const renderedResources = document.querySelectorAll('[data-resource-key]').length;
const renderedFeatures = document.querySelectorAll('[data-feature-key]').length;
const resourceCount = document.querySelector('#resourceCount');
if (resourceCount) resourceCount.textContent = `${renderedResources} mappings`;
if (renderedResources !== 25) console.error(`Control prototype expected 25 resource mappings; found ${renderedResources}.`);
if (renderedFeatures !== 14) console.error(`Control prototype expected 14 feature switches; found ${renderedFeatures}.`);

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
document.querySelectorAll('.prototype-action').forEach(button => {
  button.addEventListener('click', () => {
    const action = button.dataset.prototypeAction || button.textContent.trim();
    if (dialogTitle) dialogTitle.textContent = `${action} — preview only`;
    if (dialog?.showModal) dialog.showModal();
  });
});

// The controls intentionally remain local-only. No fetch(), WebSocket, OAuth or database client is used.
