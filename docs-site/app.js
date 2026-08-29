const startRoutes = [
  {
    audience: 'Admin',
    title: 'Setup',
    description: 'Discover existing resources, verify bindings, then configure only what you use.',
    href: '#setup',
  },
  {
    audience: 'Moderator',
    title: 'Moderate',
    description: 'Review context, act, then check hierarchy or permissions if blocked.',
    href: '#playbook-moderation',
  },
  {
    audience: 'Operations',
    title: 'Operate',
    description: 'Tickets, announcements, reputation, quizzes, feeds, analytics, and showcase.',
    href: '#playbooks',
  },
  {
    audience: 'Troubleshooting',
    title: 'Fix issues',
    description: 'Check health first; change configuration only when the symptom points there.',
    href: '#troubleshooting',
  },
];

const healthChecks = [
  {
    title: 'Reachability',
    text: 'If commands are visible, run <code>/ping</code>. If not, check command sync and hosting.',
    link: '/commands#command-ping',
    linkText: '/ping',
  },
  {
    title: 'Mappings',
    text: 'Run <code>/setup status</code>. Fix only stale or missing mappings.',
    link: '/commands#command-setup-status',
    linkText: '/setup status',
  },
  {
    title: 'Hierarchy',
    text: 'For moderation or role failures, check the caller and Rob-bot role positions first.',
    link: '#roles',
    linkText: 'Permissions',
  },
  {
    title: 'Prerequisites',
    text: 'Check the workflow for required ticket types, tags, sources, intents, tasks, or Discord permissions.',
    link: '#playbooks',
    linkText: 'Playbooks',
  },
];

const setupSteps = [
  {
    title: 'Install',
    text: 'Invite with <code>bot</code> and <code>applications.commands</code>. Confirm Rob-bot is online and commands are visible.',
  },
  {
    title: 'Environment',
    text: 'Set the token, production environment, guild ID, and background tasks. Enable Message Content only when needed and enabled in Discord.',
  },
  {
    title: 'Hierarchy',
    text: 'Place Rob-bot above members it may moderate and roles it may manage.',
  },
  {
    title: 'Discover',
    text: 'Run <code>/setup auto</code>. Clear existing matches bind without renaming or moving them.',
  },
  {
    title: 'Approve changes',
    text: 'A second approval is required for creation, remaps, Solved-tag creation, or role-panel refreshes. Declining keeps safe discovery bindings.',
  },
  {
    title: 'Verify',
    text: 'Run <code>/setup status</code>, then configure ticket types, quizzes, AI sources, reputation, log exclusions, and feature toggles as needed.',
  },
  {
    title: 'Test',
    text: 'Smoke-test only enabled workflows. Confirm ticket privacy, hierarchy, role assignment, logging, and any scheduled or live features you use.',
  },
];

const playbooks = [
  {
    id: 'playbook-moderation',
    audience: 'Moderators',
    title: 'Moderation',
    summary: 'Member incidents and anonymous-question audits.',
    steps: [
      'Use <code>/history</code> when prior context matters.',
      'Use <code>/warn</code>, <code>/timeout</code>, <code>/kick</code>, or <code>/ban</code> as required.',
      'If blocked, check moderator hierarchy, Rob-bot hierarchy, then the matching permission.',
      'Use <code>/unban</code> to reverse a ban; <code>/anonwho</code> only for legitimate moderation audits.',
      'Confirm the case or audit log.',
    ],
    commands: [
      ['/history', '/commands#command-history'],
      ['/warn', '/commands#command-warn'],
      ['/timeout', '/commands#command-timeout'],
      ['/kick', '/commands#command-kick'],
      ['/ban', '/commands#command-ban'],
      ['/unban', '/commands#command-unban'],
      ['/anonwho', '/commands#command-anonwho'],
    ],
  },
  {
    id: 'playbook-tickets',
    audience: 'Admins / staff',
    title: 'Tickets',
    summary: 'Configure topics and run the support queue.',
    steps: [
      'Check types with <code>/ticket-type list</code>.',
      'Add or update with <code>/ticket-type add</code>; retire with <code>/ticket-type disable</code>.',
      'Post a panel with <code>/ticket-panel post</code>.',
      'Staff claim, close, reopen, and export transcripts from ticket controls.',
      'If privacy is wrong, fix category permissions first.',
    ],
    commands: [
      ['/ticket-type list', '/commands#command-ticket-type-list'],
      ['/ticket-type add', '/commands#command-ticket-type-add'],
      ['/ticket-type disable', '/commands#command-ticket-type-disable'],
      ['/ticket-panel post', '/commands#command-ticket-panel-post'],
    ],
  },
  {
    id: 'playbook-publishing',
    audience: 'Admins',
    title: 'Publishing',
    summary: 'Announcements and Mar Wie live notices.',
    steps: [
      'Use <code>/announce</code> for server updates; review the private preview before sending.',
      'Use <code>/live</code> for the TikTok Live workflow; Rob-bot verifies Mar Wie at runtime.',
      'Without a live channel, <code>/live</code> falls back to announcements.',
      'Missing TikTok button: check <code>MAR_WIE_TIKTOK_URL</code>.',
    ],
    commands: [
      ['/announce', '/commands#command-announce'],
      ['/live', '/commands#command-live'],
    ],
  },
  {
    id: 'playbook-community',
    audience: 'Community ops',
    title: 'Programs',
    summary: 'Reputation, build-help, quizzes, anonymous Q&A, focus, and LFG.',
    steps: [
      'Use <code>/rank</code>, <code>/profile</code>, and <code>/leaderboard</code> to review reputation. Change thresholds or award points only by policy.',
      'Use <code>/solve</code> for accepted build-help answers.',
      'Add quiz content with <code>/quiz add</code>; start manually or schedule it.',
      'Support <code>/anonask</code>, Pomodoro, and <code>/lfg</code>; send identity audits to moderation.',
    ],
    commands: [
      ['/reputation award', '/commands#command-reputation-award'],
      ['/reputation thresholds', '/commands#command-reputation-thresholds'],
      ['/solve', '/commands#command-solve'],
      ['/quiz add', '/commands#command-quiz-add'],
      ['/quiz start', '/commands#command-quiz-start'],
      ['/quiz schedule', '/commands#command-quiz-schedule'],
      ['/anonask', '/commands#command-anonask'],
      ['/lfg', '/commands#command-lfg'],
    ],
  },
  {
    id: 'playbook-maintenance',
    audience: 'Admins',
    title: 'Maintenance',
    summary: 'Feeds, analytics, showcase, features, and logging.',
    steps: [
      'Review AI sources with <code>/ai-source list</code>; add trusted sources, poll to diagnose, disable stale ones.',
      'Use <code>/analytics</code> for operations and <code>/app-of-week</code> for manual showcase selection.',
      'Use <code>/setup feature</code> for toggles and <code>/setup log-ignore</code> for privacy boundaries.',
      'Run <code>/setup status</code> after changes; do not rerun auto-setup by default.',
    ],
    commands: [
      ['/ai-source list', '/commands#command-ai-source-list'],
      ['/ai-source add', '/commands#command-ai-source-add'],
      ['/ai-source poll', '/commands#command-ai-source-poll'],
      ['/ai-source disable', '/commands#command-ai-source-disable'],
      ['/analytics', '/commands#command-analytics'],
      ['/app-of-week', '/commands#command-app-of-week'],
      ['/setup feature', '/commands#command-setup-feature'],
      ['/setup log-ignore', '/commands#command-setup-log-ignore'],
    ],
  },
];

const supportItems = [
  ['Tickets', 'Members open private tickets from the panel. Staff handle claims, state changes, and transcripts.'],
  ['Reputation', 'Members use <code>/rank</code>, <code>/profile</code>, and <code>/leaderboard</code>. Builder, Contributor, and Mentor come from thresholds, not self-role buttons.'],
  ['Anonymous Q&A', '<code>/anonask</code> hides the sender publicly. Authorized moderators can audit identity with <code>/anonwho</code>.'],
  ['Focus & LFG', 'Pomodoro supports 5–180 minutes. <code>/lfg</code> posts what a member is building and what help they need.'],
  ['Quizzes', 'Members answer active sessions with buttons; results are revealed when the session closes.'],
  ['Solved replies', 'The thread owner or permitted staff can mark a build-help reply solved; the helper gets +10 reputation.'],
  ['Live Notifications', 'Members self-assign this role from the panel. Builder, Contributor, and Mentor are not self-roles.'],
];

const automatic = [
  ['Message logs', 'Edited or deleted messages can mirror to staff logs. Full text requires Message Content.'],
  ['Reputation', 'Eligible activity adds reputation; milestone roles reconcile to thresholds.'],
  ['Voice workspaces', 'Joining Create Workspace creates a room, moves the member, and deletes the room when empty.'],
  ['Quizzes', 'Schedules post and close quiz sessions automatically.'],
  ['AI feeds', 'Background tasks poll enabled RSS/Atom sources, post new items, and skip duplicates.'],
  ['Pomodoro', 'Active timers persist across host restarts.'],
  ['Reports & showcase', 'Configured background jobs can publish staff summaries and App of the Week automation.'],
  ['Recovery', 'Persistent controls re-register, voice rooms reconcile, and scheduled state resumes after restart.'],
];

const resources = [
  ['Moderation logs', '<code>moderation_log</code> → <code>#moderation-log</code>'],
  ['Message / bot logs', '<code>message_log</code>, <code>bot_log</code> → existing bot-logs channel'],
  ['Tickets', '<code>ticket_panel</code> → entry channel; <code>ticket_category</code> → private category; <code>ticket_logs</code> → staff logs'],
  ['Temporary voice', '<code>create_workspace_voice</code> → Create Workspace / Create VC; <code>temp_voice_category</code> → WORKSPACES / CO-WORKING SPACE'],
  ['Coworking', '<code>coworking_lounge</code> → Coworking Lounge / Coworking'],
  ['Announcements', '<code>announcements</code> → normal; <code>live_announcements</code> → live destination'],
  ['Live role', '<code>live_ping_role</code> → Live Notifications; <code>role_panel</code> → self-role channel'],
  ['AI updates', '<code>ai_updates</code> → feed destination'],
  ['Quizzes', '<code>quiz_channel</code> → quiz destination'],
  ['Anonymous Q&A', '<code>anon_questions</code> → public destination'],
  ['Analytics', '<code>analytics</code> → staff reports'],
  ['Showcase', '<code>showcase_forum</code> → forum; <code>app_of_the_week</code> → feature destination'],
  ['Collaboration', '<code>collab_lfg</code> → LFG destination'],
  ['Reputation roles', '<code>builder_role</code>, <code>contributor_role</code>, <code>mentor_role</code> → achievement roles'],
];

const faq = [
  ['Commands missing', 'Check <code>applications.commands</code>, <code>COMMAND_GUILD_ID</code>, <code>SYNC_COMMANDS</code>, and startup sync logs.'],
  ['Resource missing or stale', 'Run <code>/setup status</code>. Fix the specific mapping; rerun <code>/setup auto</code> only when another discovery pass is needed.'],
  ['Auto-setup wants a duplicate', 'Check the existing object type and normalized name/alias. Review the second plan; decline if wrong.'],
  ['Community required', 'The approved plan needs a new Forum Channel. Existing forums can still be discovered without Community.'],
  ['Moderation blocked', 'The moderator and Rob-bot must both outrank the target and hold the matching permission. The server owner cannot be targeted.'],
  ['Role not assigned', 'Check the saved role, Manage Roles, and Rob-bot hierarchy. Reputation grants Builder/Contributor/Mentor; the panel grants Live Notifications.'],
  ['Ticket visible to everyone', 'Deny <code>@everyone</code> View Channel on the ticket category; allow ticket staff explicitly.'],
  ['Message logs lack text', 'Enable Message Content in Discord and set <code>ENABLE_MESSAGE_CONTENT=true</code>.'],
  ['Scheduled jobs stopped', 'Check <code>ENABLE_BACKGROUND_TASKS</code>, the feature toggle, destination, and source/session configuration. Use <code>/ai-source poll</code> for feed diagnostics.'],
  ['/live posts elsewhere', 'Check <code>live_announcements</code>. If unavailable, Rob-bot falls back to <code>announcements</code>.'],
  ['TikTok button missing', 'Check <code>MAR_WIE_TIKTOK_URL</code>. The announcement works without it.'],
  ['Error reference shown', 'Keep the reference and find the matching bot log entry. Do not expose raw secrets or tracebacks in Discord.'],
  ['Host restarted', 'Verify <code>/ping</code> and the affected workflow. Durable controls, timers, jobs, and voice reconciliation recover automatically.'],
];

function startRouteHtml(route) {
  return `<a class="task-card" href="${route.href}"><span class="task-audience">${route.audience}</span><h3>${route.title}</h3><p>${route.description}</p></a>`;
}

function healthHtml(item, index) {
  return `<div class="health-item"><div class="health-number">${index + 1}</div><div><h3>${item.title}</h3><p>${item.text}</p><a href="${item.link}">${item.linkText} →</a></div></div>`;
}

function playbookHtml(playbook) {
  const steps = playbook.steps.map(step => `<li>${step}</li>`).join('');
  const links = playbook.commands.map(([label, href]) => `<a href="${href}"><code>${label}</code></a>`).join('');
  return `<section class="playbook" id="${playbook.id}"><div class="playbook-head"><span>${playbook.audience}</span><h3>${playbook.title}</h3><p>${playbook.summary}</p></div><ol class="playbook-steps">${steps}</ol><div class="playbook-links"><strong>Commands</strong>${links}</div></section>`;
}

document.querySelector('#startRoutes').innerHTML = startRoutes.map(startRouteHtml).join('');
document.querySelector('#healthChecks').innerHTML = healthChecks.map(healthHtml).join('');
document.querySelector('#setupSteps').innerHTML = setupSteps.map(step => `<div class="step"><div><h3>${step.title}</h3><p>${step.text}</p></div><label class="check"><input type="checkbox" aria-label="Mark ${step.title} complete"></label></div>`).join('');
document.querySelector('#playbookList').innerHTML = playbooks.map(playbookHtml).join('');
document.querySelector('#supportList').innerHTML = supportItems.map(item => `<div class="plain-item"><h3>${item[0]}</h3><p>${item[1]}</p></div>`).join('');
document.querySelector('#automaticList').innerHTML = automatic.map(item => `<div class="plain-item"><h3>${item[0]}</h3><p>${item[1]}</p></div>`).join('');
document.querySelector('#resourceList').innerHTML = resources.map(item => `<div class="resource"><b>${item[0]}</b><span>${item[1]}</span></div>`).join('');
document.querySelector('#faq').innerHTML = faq.map(item => `<details><summary>${item[0]}</summary><p>${item[1]}</p></details>`).join('');

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
  if (themeColor) themeColor.content = actual === 'dark' ? '#171719' : '#ffffff';
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

const links = [...document.querySelectorAll('.nav a[href^="#"]')];
const targets = links.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!visible) return;
    links.forEach(link => link.setAttribute('aria-current', String(link.getAttribute('href') === `#${visible.target.id}`)));
  }, { rootMargin: '-8% 0px -78% 0px' });
  targets.forEach(target => observer.observe(target));
}

const checklistKey = 'rob-bot-setup-v7';
const boxes = [...document.querySelectorAll('#setupSteps input')];
const progressBar = document.querySelector('#progressBar');
const progressText = document.querySelector('#progressText');
let saved = {};
try {
  saved = JSON.parse(localStorage.getItem(checklistKey) || '{}');
} catch {
  saved = {};
}

function updateProgress() {
  const done = boxes.filter(box => box.checked).length;
  if (progressBar) progressBar.style.width = boxes.length ? `${done / boxes.length * 100}%` : '0%';
  if (progressText) progressText.textContent = `${done} of ${boxes.length} complete`;
}

boxes.forEach((box, index) => {
  box.checked = !!saved[index];
  box.addEventListener('change', () => {
    saved[index] = box.checked;
    localStorage.setItem(checklistKey, JSON.stringify(saved));
    updateProgress();
  });
});

document.querySelector('#resetChecklist')?.addEventListener('click', () => {
  saved = {};
  localStorage.removeItem(checklistKey);
  boxes.forEach(box => {
    box.checked = false;
  });
  updateProgress();
});

updateProgress();
