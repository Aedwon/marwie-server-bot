const automatic = [
  ['Message change logs','When a message is edited or deleted, Rob-bot can record the change in a staff log channel. Admins can exclude private channels.','Full message text requires Discord Message Content.'],
  ['Reputation','Active members can earn +1 reputation, at most once every 10 minutes. Rob-bot can award Builder, Contributor, and Mentor roles at the chosen milestones.'],
  ['Temporary voice rooms','Joining Create Workspace creates a temporary voice room and moves the member into it. The room is removed when it becomes empty.'],
  ['Scheduled quizzes','When staff set a quiz schedule, Rob-bot posts a question, records one answer per person, then reveals the correct answer after the session closes.'],
  ['AI update feeds','Every 30 minutes, Rob-bot checks approved RSS or Atom feeds. New items are posted and duplicates are skipped.'],
  ['Pomodoro completion','Rob-bot remembers active focus sessions and posts when they finish, including after a hosting restart.'],
  ['Staff reports','Rob-bot can post weekly activity summaries and point staff toward build-help threads waiting more than 24 hours for attention.'],
  ['App of the Week','Rob-bot can periodically feature an active showcase thread that has not already been highlighted. Staff can still choose one manually.'],
  ['Restart recovery','After a restart, ticket and quiz controls return, temporary voice rooms are checked, active timers resume, and scheduled jobs continue from saved data.']
];
const memberCommands = [
  ['/rank · /profile','See your reputation total and progress.'],
  ['/leaderboard','See the highest-reputation members in the server.'],
  ['/anonask','Post a question without showing your identity publicly. Authorized moderators can still audit the sender for a legitimate moderation reason.'],
  ['/pomodoro','Start, check, or stop a focus timer between 5 and 180 minutes.'],
  ['/lfg','Post what you are building and what kind of collaborator or help you want.'],
  ['/solve','In build-help, mark a reply as the solution. The helper receives +10 reputation.'],
  ['Ticket panel','Use the ticket button to open a private support ticket.'],
  ['Quiz buttons','Answer quizzes using A, B, C, or D. Each person can submit one answer per session.']
];
const staffCommands = [
  ['/warn','Record a formal warning and save it in the member moderation history.'],
  ['/timeout','Temporarily restrict a member for the chosen number of minutes.'],
  ['/kick · /ban · /unban','Remove, ban, or restore a member when Discord permissions and role order allow it.'],
  ['/history','Review recent saved moderation cases for a member.'],
  ['/anonwho','Authorized moderators can identify the sender of an anonymous question for moderation purposes.'],
  ['/ticket-type · /ticket-panel','Create ticket options and publish the panel. Ticket controls support claim, close, reopen, and transcripts.'],
  ['/announce','Write an announcement, preview it privately, then send or edit it.'],
  ['/reputation award · /reputation thresholds','Adjust reputation manually or change Builder, Contributor, and Mentor milestones.'],
  ['/quiz','Add questions, start a quiz manually, or choose the schedule.'],
  ['/ai-source','Add, list, disable, or manually test trusted RSS/Atom sources.'],
  ['/analytics','See a summary of the previous seven days of community operations.'],
  ['/app-of-week','Choose a showcase thread to feature manually.'],
  ['/setup …','Connect channels, voice rooms, forums, categories, roles, the Solved tag, feature switches, and logging exclusions.']
];
const steps = [
  ['Install Rob-bot','Install with the bot and applications.commands scopes, using the permissions listed in Roles and hierarchy.'],
  ['Choose Message Content','Leave Presence and Server Members off. Turn Message Content on if you want full logs, richer transcripts, solution excerpts, and message-based reputation context.'],
  ['Add hosting settings','Set DISCORD_TOKEN, ENVIRONMENT=production, COMMAND_GUILD_ID, and ENABLE_MESSAGE_CONTENT=true when that intent is enabled. Leave DATABASE_URL unset to start with SQLite.'],
  ['Create Discord resources','Create the channels, forums, categories, and roles below. Put protected admins above Rob-bot and roles Rob-bot manages below it.'],
  ['Connect everything with /setup','Map text channels, voice channels, forums, categories, roles, and the Solved tag. Use /setup status to check for anything missing.'],
  ['Set up tickets','Add ticket types, post the panel, then test create, claim, close, transcript, and reopen.'],
  ['Set up reputation and build-help','Connect Builder, Contributor, Mentor, build-help, and the Solved tag. Test marking a reply as solved.'],
  ['Add a quiz','Add one question and start it manually. If that works, set the schedule you want.'],
  ['Add AI feeds and community tools','Add only trusted feeds. Test a feed poll, anonymous question, Pomodoro timer, LFG post, and temporary voice room.'],
  ['Review privacy and run a final check','Exclude private channels from message logging, turn off unused features, then smoke-test a ticket, a temporary voice room, a quiz, and one background feature.']
];
const resources = [
  ['Moderation log','#moderation-log — saved moderation cases'],
  ['Message log','#bot-logs or a dedicated log channel — edited/deleted messages'],
  ['Ticket panel','#ticket — member entry point'],
  ['Ticket category','Private Tickets — deny @everyone View Channel; allow staff'],
  ['Ticket logs','#ticket-logs — events and transcripts'],
  ['Create Workspace','Create Workspace voice channel — temporary-room trigger'],
  ['Temporary voice','A voice category for generated rooms'],
  ['Coworking','Coworking Lounge — permanent voice room'],
  ['Announcements','#announcements'],
  ['AI updates','#ai-updates'],
  ['Build help','#build-help forum + Solved tag'],
  ['Quiz channel','A learning or quiz channel'],
  ['Anonymous questions','Public destination for /anonask'],
  ['Analytics','A staff-only reports channel'],
  ['Showcase','#showcase forum + #app-of-the-week'],
  ['Collaboration','#collab-lfg'],
  ['Reputation roles','Builder, Contributor, Mentor']
];
const faq = [
  ['Slash commands do not appear.','Check applications.commands, the COMMAND_GUILD_ID value, and command syncing. Restart after changing those settings.'],
  ['Rob-bot cannot moderate someone.','The moderator highest role must be above the target, and Rob-bot must also be above the target. The server owner can never be targeted.'],
  ['Reputation roles are not being assigned.','Connect Builder, Contributor, and Mentor with /setup role. Rob-bot needs Manage Roles and must sit above those roles.'],
  ['Edited or deleted messages show no text.','Enable Message Content in the Developer Portal and set ENABLE_MESSAGE_CONTENT=true on the host.'],
  ['Everyone can see a ticket.','Deny @everyone View Channel on the ticket category, then explicitly allow only the staff roles that should handle tickets.'],
  ['AI updates are not appearing.','Check the AI updates channel, background tasks, and source status. Staff can run /ai-source poll to test it.'],
  ['What happens if the host restarts?','Most state is saved. Rob-bot restores ticket and quiz controls, checks temporary voice rooms, resumes timers, and continues scheduled work.']
];

document.querySelector('#automaticList').innerHTML = automatic.map(x => `<div class="plain-item"><h3>${x[0]}</h3><p>${x[1]}${x[2] ? `<span class="meta">${x[2]}</span>` : ''}</p></div>`).join('');
const commandRows = items => items.map(x => `<div class="command"><div><code>${x[0]}</code></div><p>${x[1]}</p></div>`).join('');
document.querySelector('#memberCommands').innerHTML = commandRows(memberCommands);
document.querySelector('#staffCommands').innerHTML = commandRows(staffCommands);
document.querySelector('#setupSteps').innerHTML = steps.map(x => `<div class="step"><div><h3>${x[0]}</h3><p>${x[1]}</p></div><label class="check"><input type="checkbox" aria-label="Mark ${x[0]} complete"></label></div>`).join('');
document.querySelector('#resourceList').innerHTML = resources.map(x => `<div class="resource"><b>${x[0]}</b><span>${x[1]}</span></div>`).join('');
document.querySelector('#faq').innerHTML = faq.map(x => `<details><summary>${x[0]}</summary><p>${x[1]}</p></details>`).join('');

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
  themeColor.content = actual === 'dark' ? '#171719' : '#ffffff';
}
themeButtons.forEach(button => button.addEventListener('click', () => applyTheme(button.dataset.themeChoice)));
scheme.addEventListener?.('change', () => { if (root.dataset.preference === 'system') applyTheme('system'); });
applyTheme(root.dataset.preference || 'system');

const side = document.querySelector('#sidebar');
const menuBtn = document.querySelector('#menuBtn');
function closeMenu() { side.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }
menuBtn.addEventListener('click', () => { const open = side.classList.toggle('open'); menuBtn.setAttribute('aria-expanded', String(open)); });
side.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', () => { if (innerWidth <= 900) closeMenu(); }));
addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

const links = [...document.querySelectorAll('.nav a[href^="#"]')];
const targets = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
const observer = new IntersectionObserver(entries => {
  const visible = entries.filter(e => e.isIntersecting).sort((a,b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
  if (!visible) return;
  links.forEach(a => a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + visible.target.id)));
}, { rootMargin: '-8% 0px -78% 0px' });
targets.forEach(t => observer.observe(t));

const key = 'rob-bot-setup-v6';
const boxes = [...document.querySelectorAll('#setupSteps input')];
const progressBar = document.querySelector('#progressBar');
const progressText = document.querySelector('#progressText');
let saved = {};
try { saved = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
function updateProgress() {
  const done = boxes.filter(x => x.checked).length;
  progressBar.style.width = `${done / boxes.length * 100}%`;
  progressText.textContent = `${done} of ${boxes.length} complete`;
}
boxes.forEach((box, i) => {
  box.checked = !!saved[i];
  box.addEventListener('change', () => { saved[i] = box.checked; localStorage.setItem(key, JSON.stringify(saved)); updateProgress(); });
});
document.querySelector('#resetChecklist').addEventListener('click', () => {
  saved = {};
  localStorage.removeItem(key);
  boxes.forEach(b => b.checked = false);
  updateProgress();
});
updateProgress();
