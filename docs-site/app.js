const startRoutes = [
  {
    audience: 'Administrator',
    title: 'I am setting Rob-bot up',
    description: 'Use the discovery-first onboarding path, verify what Rob-bot connected, then add only the community content and policy choices you actually need.',
    href: '#setup',
    action: 'Go to first-time setup',
  },
  {
    audience: 'Moderator on duty',
    title: 'I need to handle an incident',
    description: 'Review context, choose the appropriate moderation action, and know which hierarchy or permission checks can block it.',
    href: '#playbook-moderation',
    action: 'Open moderation playbook',
  },
  {
    audience: 'Admin / community operations',
    title: 'I need to run a community workflow',
    description: 'Use the playbooks for tickets, announcements, live notifications, reputation, quizzes, feeds, analytics, and showcase operations.',
    href: '#playbooks',
    action: 'Browse on-duty playbooks',
  },
  {
    audience: 'Troubleshooting',
    title: 'Something is not working',
    description: 'Run the quick health check first, then diagnose from the symptom before changing channels, roles, or hosting settings.',
    href: '#troubleshooting',
    action: 'Diagnose the problem',
  },
];

const healthChecks = [
  {
    title: 'Can Discord see and reach Rob-bot?',
    text: 'If slash commands are visible, run <code>/ping</code>. If commands are missing entirely, skip ahead to command-sync and hosting checks instead of changing server resources.',
    link: '/commands#command-ping',
    linkText: 'Open /ping reference',
  },
  {
    title: 'Are the saved Discord mappings healthy?',
    text: 'Run <code>/setup status</code>. Stale or missing channel, role, category, forum, or tag mappings are configuration problems. Fix only the affected mapping.',
    link: '/commands#command-setup-status',
    linkText: 'Open setup-status reference',
  },
  {
    title: 'Is role hierarchy blocking the action?',
    text: 'For moderation or managed-role failures, check the caller role and Rob-bot role before changing setup. Discord hierarchy can reject an otherwise valid command.',
    link: '#roles',
    linkText: 'Check permissions and hierarchy',
  },
  {
    title: 'Is the feature prerequisite actually configured?',
    text: 'Check the relevant playbook and troubleshooting entry. Some workflows depend on ticket types, a Solved tag, a feed source, Message Content, background tasks, or a specific Discord permission.',
    link: '#playbooks',
    linkText: 'Check the workflow',
  },
];

const setupSteps = [
  {
    title: 'Install Rob-bot and confirm commands sync',
    text: 'Invite the bot with the <code>bot</code> and <code>applications.commands</code> scopes. Confirm Rob-bot is online and slash commands are visible before configuring Discord resources.',
  },
  {
    title: 'Set the deployment essentials',
    text: 'Configure the Discord token, production environment, guild-scoped command ID during setup, and background tasks. Enable Message Content only if you want the extra logging/transcript/reputation context and the Discord intent is also enabled.',
  },
  {
    title: 'Place Rob-bot correctly in the role hierarchy',
    text: 'Give Rob-bot the permissions used by the enabled workflows and place its highest role above members it may moderate and above Builder, Contributor, Mentor, and Live Notifications when it needs to manage those roles.',
  },
  {
    title: 'Run /setup auto against the server you already have',
    text: 'Approve the discovery confirmation. Rob-bot searches existing channels, forums, categories, voice channels, and roles by normalized names and known aliases. Clear matches are connected without renaming or moving them.',
  },
  {
    title: 'Review the second mutation plan only if one appears',
    text: 'Creation, automatic-style remaps, Solved-tag creation, and role-panel refreshes require a second explicit approval. Read the listed changes before approving them. Declining keeps safe discovery bindings but skips those mutations.',
  },
  {
    title: 'Verify with /setup status, then make intentional choices',
    text: 'Check for stale mappings. Then configure the content auto-setup intentionally does not invent: ticket types, quiz questions/schedule, trusted AI feeds, reputation thresholds, log exclusions, and feature toggles.',
  },
  {
    title: 'Smoke-test only the workflows you will use',
    text: 'Test moderation hierarchy, one ticket, one announcement, role assignment, a quiz, feeds, anonymous questions, temporary voice, or <code>/live</code> as applicable. Confirm private channels and logging exclusions before considering setup complete.',
  },
];

const playbooks = [
  {
    id: 'playbook-moderation',
    audience: 'Moderator / administrator',
    title: 'Moderate and investigate',
    summary: 'Use this when handling a member incident or reviewing an anonymous-question audit request.',
    steps: [
      'Use <code>/history</code> when prior moderation context is relevant.',
      'Choose <code>/warn</code>, <code>/timeout</code>, <code>/kick</code>, or <code>/ban</code> based on the action actually required.',
      'If the action is refused, check caller hierarchy, Rob-bot hierarchy, and the matching Discord permission before changing configuration.',
      'Use <code>/unban</code> only when reversing a ban. Use <code>/anonwho</code> only for a legitimate moderation audit.',
      'Confirm the resulting case/audit trail is present where expected.',
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
    audience: 'Admin setup / staff handling',
    title: 'Run support tickets',
    summary: 'Use this when changing support topics or helping staff operate the ticket queue.',
    steps: [
      'Check enabled ticket types with <code>/ticket-type list</code>.',
      'Add/update a type with <code>/ticket-type add</code> or retire one with <code>/ticket-type disable</code>.',
      'Use <code>/ticket-panel post</code> when you need a new ticket entry panel.',
      'Members open tickets from the panel. Staff claim, close, reopen, and produce transcripts through the ticket controls.',
      'If privacy is wrong, inspect the ticket category permissions before changing the ticket commands.',
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
    audience: 'Admin / leadership',
    title: 'Publish announcements and live notices',
    summary: 'Use the normal announcement flow for server updates and the dedicated live flow for Mar Wie’s TikTok Live notice.',
    steps: [
      'Use <code>/announce</code> for normal server communications and review its private preview before sending.',
      'Use <code>/live</code> only for the TikTok Live workflow. Rob-bot still verifies the configured Mar Wie account at runtime.',
      'If <code>/live</code> has no dedicated live channel, it falls back to the normal announcements mapping.',
      'If the TikTok button is missing, check the host URL setting instead of reposting repeatedly.',
    ],
    commands: [
      ['/announce', '/commands#command-announce'],
      ['/live', '/commands#command-live'],
    ],
  },
  {
    id: 'playbook-community',
    audience: 'Admin / community operations',
    title: 'Run reputation, learning, and participation programs',
    summary: 'Use this for the community systems that require intentional content or policy decisions after infrastructure setup.',
    steps: [
      'Review reputation with <code>/rank</code>, <code>/profile</code>, and <code>/leaderboard</code>. Change thresholds or award points only when policy calls for it.',
      'Use <code>/solve</code> for accepted build-help answers so the helper receives the configured recognition.',
      'Add quiz content with <code>/quiz add</code>, then start it manually or set the schedule.',
      'Support <code>/anonask</code>, Pomodoro, and <code>/lfg</code> as member-facing tools. Route identity audits back to the moderation workflow.',
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
    audience: 'Admin / community operations',
    title: 'Maintain feeds, reports, and feature configuration',
    summary: 'Use this when reviewing trusted information sources, operational reports, showcase selection, or feature-level configuration.',
    steps: [
      'Review configured AI sources with <code>/ai-source list</code>. Add trusted sources, poll manually when diagnosing, and disable stale sources.',
      'Use <code>/analytics</code> for the recent operations summary and <code>/app-of-week</code> for a manual showcase selection.',
      'Use <code>/setup feature</code> for intentional feature enable/disable changes and <code>/setup log-ignore</code> for logging privacy boundaries.',
      'Use <code>/setup status</code> after configuration changes instead of rerunning auto-setup blindly.',
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
  ['Support tickets', 'Members open a private ticket from the configured panel and choose an enabled ticket type. A member can have only the active ticket behavior documented by the bot; staff manage the rest through ticket controls.'],
  ['Reputation and profiles', 'Members use <code>/rank</code>, <code>/profile</code>, and <code>/leaderboard</code>. Builder, Contributor, and Mentor are achievement roles managed by reputation thresholds, not self-role buttons.'],
  ['Anonymous questions', '<code>/anonask</code> hides the sender publicly, but authorized moderators can audit the sender with <code>/anonwho</code> for moderation purposes. Do not describe the feature as staff-untraceable anonymity.'],
  ['Pomodoro and collaboration', 'Members can run a 5–180 minute focus timer and use <code>/lfg</code> to post what they are building and what help or collaborator they need.'],
  ['Quizzes', 'Members answer active quiz sessions with the provided buttons. Each session records the supported answer behavior and later reveals the result when the session closes.'],
  ['Solved build-help replies', 'The thread owner, or staff with the required thread permission, can mark a helpful reply as solved. The helper receives the configured +10 reputation award.'],
  ['Live Notifications role', 'Members opt into or out of the configured Live Notifications role from the self-role panel. Builder, Contributor, and Mentor do not appear on that panel.'],
];

const automatic = [
  ['Message change logs', 'When enabled and configured, edited or deleted messages can be mirrored to the staff message-log destination. Full before/after message text depends on Message Content.'],
  ['Reputation accrual and milestone roles', 'Eligible activity can add reputation at the configured cadence. Rob-bot reconciles Builder, Contributor, and Mentor against their thresholds.'],
  ['Temporary voice workspaces', 'Joining the configured Create Workspace voice channel creates a temporary room, moves the member, and removes the room after it becomes empty.'],
  ['Scheduled quizzes', 'Configured quiz schedules post sessions automatically and close/reveal them according to the saved session timing.'],
  ['AI update feeds', 'With background tasks enabled, Rob-bot polls enabled RSS/Atom sources, posts new items, and skips previously stored duplicates.'],
  ['Pomodoro completion', 'Active focus sessions are persisted so completion can still be reconciled after a hosting restart.'],
  ['Staff reports and showcase automation', 'Background jobs can produce scheduled operational summaries and App of the Week behavior when those systems are configured and enabled.'],
  ['Restart recovery', 'Persistent ticket, quiz, and Live Notifications controls are re-registered; temporary voice rooms are reconciled; scheduled state resumes from durable records.'],
];

const resources = [
  ['Moderation logs', '<code>moderation_log</code> → typically <code>#moderation-log</code>'],
  ['Message / bot logs', '<code>message_log</code> and <code>bot_log</code> → commonly the existing bot-logs channel'],
  ['Ticket entry', '<code>ticket_panel</code> → existing ticket/tickets channel; <code>ticket_category</code> → private ticket category; <code>ticket_logs</code> → staff transcript/log destination'],
  ['Temporary voice', '<code>create_workspace_voice</code> → Create Workspace / Create VC; <code>temp_voice_category</code> → WORKSPACES / CO-WORKING SPACE'],
  ['Coworking lounge', '<code>coworking_lounge</code> → Coworking Lounge / Coworking'],
  ['Announcements', '<code>announcements</code> → normal announcements; <code>live_announcements</code> → dedicated live channel when present'],
  ['Live self-role', '<code>live_ping_role</code> → Live Notifications; <code>role_panel</code> → roles channel containing the self-role control'],
  ['AI updates', '<code>ai_updates</code> → AI update destination'],
  ['Build help', '<code>build_help_forum</code> → build-help/general-questions Forum Channel; <code>solved_tag</code> → Solved forum tag'],
  ['Quizzes', '<code>quiz_channel</code> → quiz/learning destination'],
  ['Anonymous questions', '<code>anon_questions</code> → public anonymous-question destination'],
  ['Analytics', '<code>analytics</code> → staff report destination'],
  ['Showcase', '<code>showcase_forum</code> → Forum Channel; <code>app_of_the_week</code> → feature destination'],
  ['Collaboration', '<code>collab_lfg</code> → LFG/collaboration destination'],
  ['Reputation roles', '<code>builder_role</code>, <code>contributor_role</code>, and <code>mentor_role</code> → existing achievement roles'],
];

const faq = [
  ['Slash commands do not appear at all.', '<strong>First check:</strong> the <code>applications.commands</code> scope, <code>COMMAND_GUILD_ID</code> during setup, <code>SYNC_COMMANDS</code>, and startup command-sync logs. This is not a channel-mapping problem.'],
  ['Rob-bot responds, but a feature says a resource is missing or stale.', '<strong>First check:</strong> run <code>/setup status</code>. Fix the specific stale mapping with the appropriate manual <code>/setup …</code> command, or use <code>/setup auto</code> when you genuinely need another discovery pass.'],
  ['/setup auto wants to create something that already exists.', '<strong>First check:</strong> confirm the existing object has the expected Discord type and a recognizable normalized name/alias. Auto-setup will not treat a category as a Forum Channel, for example. Review the second mutation plan and decline if it is not correct.'],
  ['/setup auto says Community is required.', '<strong>Meaning:</strong> the approved plan needs Rob-bot to create a new Forum Channel. Existing Forum Channels can be discovered without Community. Enable Community only if you actually want Rob-bot to create the missing forum.'],
  ['Rob-bot cannot warn, timeout, kick, or ban someone.', '<strong>First check:</strong> role hierarchy. The acting moderator must be above the target, and Rob-bot must also be above the target. Then check the matching Discord permission. The server owner cannot be targeted.'],
  ['Builder, Contributor, Mentor, or Live Notifications is not being assigned.', '<strong>First check:</strong> the stored role mapping and Rob-bot role position. Rob-bot needs Manage Roles and must be above the role. Builder/Contributor/Mentor come from reputation; Live Notifications comes from the self-role panel.'],
  ['Everyone can see a ticket.', '<strong>First check:</strong> ticket-category permission overwrites. Deny <code>@everyone</code> View Channel and explicitly allow the staff roles that should handle tickets.'],
  ['Edited or deleted messages have no useful text.', '<strong>First check:</strong> Message Content must be enabled in both the Discord Developer Portal and <code>ENABLE_MESSAGE_CONTENT=true</code> on the host.'],
  ['AI updates or other scheduled jobs are not running.', '<strong>First check:</strong> <code>ENABLE_BACKGROUND_TASKS</code>, the relevant feature toggle, the mapped destination, and source/session configuration. Use <code>/ai-source poll</code> for a focused feed diagnostic.'],
  ['/live does not post where expected.', '<strong>First check:</strong> <code>live_announcements</code>. Rob-bot falls back to <code>announcements</code> when the dedicated live destination is absent or stale. If both are unusable, it stops with a setup error.'],
  ['The Watch on TikTok button is missing.', '<strong>First check:</strong> <code>MAR_WIE_TIKTOK_URL</code> on the host. The live announcement itself can work without that optional URL.'],
  ['A command fails and shows an error reference.', '<strong>Next step:</strong> keep the short error reference and check the bot logs for the matching reference. Do not expose raw secrets or tracebacks in Discord while troubleshooting.'],
  ['The host restarted. What should staff do?', '<strong>Expected:</strong> most durable systems reconcile automatically. Verify <code>/ping</code> and the affected workflow before manually rebuilding state. Persistent controls, timers, scheduled jobs, and temporary voice reconciliation are designed to survive restart.'],
];

function startRouteHtml(route) {
  return `<a class="task-card" href="${route.href}"><span class="task-audience">${route.audience}</span><h3>${route.title}</h3><p>${route.description}</p><span class="task-action">${route.action} →</span></a>`;
}

function healthHtml(item, index) {
  return `<div class="health-item"><div class="health-number">${index + 1}</div><div><h3>${item.title}</h3><p>${item.text}</p><a href="${item.link}">${item.linkText} →</a></div></div>`;
}

function playbookHtml(playbook) {
  const steps = playbook.steps.map(step => `<li>${step}</li>`).join('');
  const links = playbook.commands.map(([label, href]) => `<a href="${href}"><code>${label}</code></a>`).join('');
  return `<section class="playbook" id="${playbook.id}"><div class="playbook-head"><span>${playbook.audience}</span><h3>${playbook.title}</h3><p>${playbook.summary}</p></div><ol class="playbook-steps">${steps}</ol><div class="playbook-links"><strong>Exact command reference</strong>${links}</div></section>`;
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
