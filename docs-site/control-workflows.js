function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\"', '&quot;')
    .replaceAll("'", '&#39;');
}

export const WORKFLOW_PAGE_CONFIGS = Object.freeze({
  '/control/workflows/moderation': Object.freeze({
    title: 'Moderation',
    intro: 'A staff operating guide for preparing, executing, verifying, and reviewing Rob-bot moderation actions.',
    stages: Object.freeze([
      Object.freeze({
        title: 'Prepare',
        body: 'Choose the action the moderation team has already decided to take and verify the command prerequisites before opening it in Discord.',
        points: Object.freeze([
          'Warn and timeout require Moderate Members; kick requires Kick Members; ban requires Ban Members.',
          'Warn, timeout, kick, and ban require the moderation feature and apply the shared target hierarchy checks.',
        ]),
        links: Object.freeze([
          Object.freeze({ href: '/control/commands', label: 'Review moderation commands' }),
          Object.freeze({ href: '/control/mappings/channels', label: 'Check moderation log mapping' }),
        ]),
      }),
      Object.freeze({
        title: 'Execute',
        body: 'Use the matching slash command, review its private confirmation, and approve only after the target and reason are correct.',
        points: Object.freeze([
          'Rob-bot validates the moderator and bot role hierarchy before the Discord action runs.',
          'Warnings, timeouts, kicks, bans, and unbans create moderation cases after their documented action path succeeds.',
        ]),
      }),
      Object.freeze({
        title: 'Verify',
        body: 'Confirm the Discord action and use Rob-bot records when staff need an auditable follow-up.',
        points: Object.freeze([
          'Recorded cases are also sent to the configured moderation log when that destination is available.',
          '/history privately shows up to the 10 most recent cases for a current server member.',
        ]),
      }),
      Object.freeze({
        title: 'Exceptions',
        body: 'Keep runtime failures separate from policy decisions so staff can tell whether the action failed or only a secondary notification did.',
        points: Object.freeze([
          'A missing moderation-log destination does not erase a database case.',
          'Documented member-DM failures do not cancel warn, kick, or ban actions.',
          '/history is read-only and currently remains available when the moderation feature is disabled.',
        ]),
      }),
    ]),
  }),
  '/control/workflows/ticket-handling': Object.freeze({
    title: 'Ticket handling',
    intro: 'A staff operating guide for ticket readiness, intake, handling, closure, and recovery.',
    stages: Object.freeze([
      Object.freeze({
        title: 'Prepare',
        body: 'Keep ticket types in Ticket configuration and Discord destinations in Mappings before publishing the member entry point.',
        points: Object.freeze([
          'The ticket panel needs an existing ticket_panel text channel and at least one enabled ticket type.',
          'Each /ticket-panel post invocation sends a new panel message; it does not edit an older one.',
        ]),
        links: Object.freeze([
          Object.freeze({ href: '/control/utilities/ticket-configuration', label: 'Review ticket configuration' }),
          Object.freeze({ href: '/control/mappings/channels', label: 'Check ticket channel mappings' }),
          Object.freeze({ href: '/control/mappings/categories', label: 'Check ticket category mapping' }),
          Object.freeze({ href: '/control/commands', label: 'Review ticket commands' }),
        ]),
      }),
      Object.freeze({
        title: 'Intake',
        body: 'Members enter through the persistent Open ticket control and choose from the currently enabled ticket types.',
        points: Object.freeze([
          'The type selector is ephemeral and remains available for 120 seconds.',
          'A member can have only one active open or claimed ticket at a time.',
          'Choosing a type creates a private ticket channel under the configured category and grants the opener access.',
        ]),
      }),
      Object.freeze({
        title: 'Handle and verify',
        body: 'Staff can claim, close, and reopen tickets with the documented ticket controls.',
        points: Object.freeze([
          'Claim, Close, and Reopen require Manage Channels or Moderate Members.',
          'Closing hides the channel from the opener, records the closure, prefixes the channel name when possible, and attempts a transcript of up to 500 messages to ticket_logs.',
          'Reopen restores opener access and removes the closed- prefix when possible.',
        ]),
      }),
      Object.freeze({
        title: 'Exceptions',
        body: 'Use the stored ticket state and log destination to distinguish a normal closure from a Discord-resource problem.',
        points: Object.freeze([
          'Disabled ticket types stop appearing for new intake but do not delete past tickets that used them.',
          'A missing ticket-log destination can prevent transcript delivery without changing the ticket closure itself.',
        ]),
      }),
    ]),
  }),
  '/control/workflows/events': Object.freeze({
    title: 'Events',
    intro: 'A publishing guide for event announcements and live alerts using the existing Announcements, Live, and Mappings owners.',
    stages: Object.freeze([
      Object.freeze({
        title: 'Prepare',
        body: 'Verify the feature state and destination before drafting the event communication.',
        points: Object.freeze([
          'Announcements and Live keep their own feature state; Discord destinations stay in Mappings.',
          'Live needs live_announcements or the fallback announcements mapping and permission to send messages and embeds.',
        ]),
        links: Object.freeze([
          Object.freeze({ href: '/control/content/announcements', label: 'Open Announcements' }),
          Object.freeze({ href: '/control/content/live', label: 'Open Live' }),
          Object.freeze({ href: '/control/mappings/channels', label: 'Check destination mappings' }),
        ]),
      }),
      Object.freeze({
        title: 'Compose',
        body: 'Build the copy in the owning Control surface or use the documented Discord command path, then review the preview and destination.',
        points: Object.freeze([
          'The Control Announcement builder keeps its composer values local until Post announcement is used.',
          'The Discord /announce path provides an ephemeral preview with Send, Edit, and Cancel controls for the original author.',
        ]),
        links: Object.freeze([
          Object.freeze({ href: '/control/commands', label: 'Review publishing commands' }),
        ]),
      }),
      Object.freeze({
        title: 'Publish and verify',
        body: 'Use the owning publish action, complete any required consequence confirmation, and verify the resulting message in Discord.',
        points: Object.freeze([
          'Live uses the configured live destination and falls back to announcements when the live mapping is unavailable.',
          'Rob-bot never uses @everyone or @here for the /live command.',
        ]),
      }),
      Object.freeze({
        title: 'Exceptions',
        body: 'A missing optional live-link or notification ping should not be confused with a failed live post.',
        points: Object.freeze([
          'If MAR_WIE_TIKTOK_URL is not configured, the live announcement can still post without a link button.',
          'If the configured Live Notifications role cannot be mentioned, the live announcement still posts and the invoker is told the ping was skipped.',
        ]),
      }),
    ]),
  }),
});

function stageMarkup(stage, index) {
  const links = (stage.links || []).length
    ? `<div class="workflow-links">${stage.links.map(link => `<a class="control-inline-action" href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`).join('')}</div>`
    : '';
  const points = (stage.points || []).length
    ? `<ul>${stage.points.map(point => `<li>${escapeHtml(point)}</li>`).join('')}</ul>`
    : '';
  return `
    <li class="workflow-stage">
      <span class="workflow-stage-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
      <div class="workflow-stage-content">
        <h2>${escapeHtml(stage.title)}</h2>
        <p>${escapeHtml(stage.body)}</p>
        ${points}
        ${links}
      </div>
    </li>`;
}

export function workflowPageMarkup(pageKey) {
  const config = WORKFLOW_PAGE_CONFIGS[pageKey];
  if (!config) return '';
  return `
    <article class="control-page workflow-page" data-page-key="${escapeHtml(pageKey)}">
      <header class="workflow-page-header">
        <h1>${escapeHtml(config.title)}</h1>
        <p>${escapeHtml(config.intro)}</p>
      </header>
      <ol class="workflow-timeline">
        ${config.stages.map(stageMarkup).join('')}
      </ol>
    </article>`;
}
