function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export const WORKFLOW_PAGE_CONFIGS = Object.freeze({
  '/control/workflows/moderation': Object.freeze({
    title: 'Moderation',
    intro: 'A practical reference for handling member issues with Rob-bot while keeping policy decisions with moderators.',
    sections: Object.freeze([
      Object.freeze({
        title: 'Before taking action',
        body: 'Confirm the report, choose the least severe appropriate response, and make sure the acting moderator has the Discord permission required by the command.',
        links: Object.freeze([
          Object.freeze({ href: '/control/commands', label: 'Review moderation commands' }),
          Object.freeze({ href: '/control/mappings/channels', label: 'Check the moderation log mapping' }),
        ]),
      }),
      Object.freeze({
        title: 'Standard flow',
        steps: Object.freeze([
          'Use the relevant moderation command and review its private confirmation before approval.',
          'Rob-bot checks moderator permissions and role hierarchy before applying the Discord action.',
          'A moderation case is recorded for warnings, timeouts, kicks, and bans.',
          'When configured, Rob-bot mirrors the case to the moderation log and attempts the member notification where supported.',
        ]),
      }),
      Object.freeze({
        title: 'Follow-up',
        body: 'Use the command history view when staff need context on earlier cases. Keep policy interpretation and escalation decisions with the moderation team.',
      }),
    ]),
  }),
  '/control/workflows/ticket-handling': Object.freeze({
    title: 'Ticket handling',
    intro: 'A reference for the member-to-staff support path, from ticket configuration through closure and transcript logging.',
    sections: Object.freeze([
      Object.freeze({
        title: 'Prepare the support path',
        body: 'Keep ticket types in their owning Control page and Discord destinations in Mappings. The ticket panel itself is posted with the matching command.',
        links: Object.freeze([
          Object.freeze({ href: '/control/utilities/ticket-configuration', label: 'Review ticket configuration' }),
          Object.freeze({ href: '/control/mappings/channels', label: 'Check ticket channel mappings' }),
          Object.freeze({ href: '/control/mappings/categories', label: 'Check the ticket category mapping' }),
          Object.freeze({ href: '/control/commands', label: 'Review ticket commands' }),
        ]),
      }),
      Object.freeze({
        title: 'Member and staff flow',
        steps: Object.freeze([
          'A member opens the posted ticket panel and chooses an available ticket type.',
          'Rob-bot creates the private ticket channel under the configured category and grants the opener access.',
          'Staff can claim the ticket, resolve the request, and close it with a reason.',
          'On closure, Rob-bot hides the channel from the opener, marks the ticket closed, and sends the transcript to the configured ticket log when available.',
        ]),
      }),
      Object.freeze({
        title: 'Exceptions',
        body: 'If a ticket channel disappears manually, Rob-bot marks the stored ticket deleted and reports that event to the ticket log when the destination is available.',
      }),
    ]),
  }),
  '/control/workflows/events': Object.freeze({
    title: 'Events',
    intro: 'A handbook for coordinated event announcements using the existing Announcements and Live owners without creating another configuration surface.',
    sections: Object.freeze([
      Object.freeze({
        title: 'Prepare communication',
        body: 'Confirm the destination mappings and feature state in the Control pages that already own them.',
        links: Object.freeze([
          Object.freeze({ href: '/control/content/announcements', label: 'Review Announcements' }),
          Object.freeze({ href: '/control/content/live', label: 'Review Live' }),
          Object.freeze({ href: '/control/mappings/channels', label: 'Check destination mappings' }),
          Object.freeze({ href: '/control/commands', label: 'Review publishing commands' }),
        ]),
      }),
      Object.freeze({
        title: 'Announcement flow',
        steps: Object.freeze([
          'Draft the event copy and verify the intended audience before using the publishing command.',
          'Review the private command confirmation, including any role mention consequence, before approval.',
          'Verify the message in the configured destination after Rob-bot posts it.',
          'Use the owning Announcements or Live page for feature changes, and Mappings for destination changes.',
        ]),
      }),
      Object.freeze({
        title: 'Operational note',
        body: 'This page documents the staff process only. It does not own feature flags, Discord resources, or publishing actions.',
      }),
    ]),
  }),
});

function sectionMarkup(section) {
  const links = (section.links || []).length
    ? `<div class="workflow-links">${section.links.map(link => `<a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`).join('')}</div>`
    : '';
  const steps = (section.steps || []).length
    ? `<ol>${section.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>`
    : '';
  return `
    <section class="workflow-section">
      <h2>${escapeHtml(section.title)}</h2>
      ${section.body ? `<p>${escapeHtml(section.body)}</p>` : ''}
      ${steps}
      ${links}
    </section>`;
}

export function workflowPageMarkup(pageKey) {
  const config = WORKFLOW_PAGE_CONFIGS[pageKey];
  if (!config) return '';
  return `
    <article class="control-page workflow-page" data-page-key="${escapeHtml(pageKey)}">
      <header class="workflow-page-header">
        <p class="control-eyebrow">Handbook</p>
        <h1>${escapeHtml(config.title)}</h1>
        <p>${escapeHtml(config.intro)}</p>
      </header>
      <div class="workflow-sections">
        ${config.sections.map(sectionMarkup).join('')}
      </div>
    </article>`;
}
