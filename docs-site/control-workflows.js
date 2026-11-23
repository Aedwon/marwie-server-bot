import { registerControlPage, registeredControlPage } from './control-page-registry.js';
import {
  controlSectionMarkup,
  controlSimplePageHeaderMarkup,
  disclosure,
  masterSwitchRow,
  setDisclosureOpen,
  settingRow,
  settingsRows,
  settingsSection,
  switchMarkup,
} from './control-components.js?v=25';
import { featureResourceKeys } from './control-resource-contract.js';
import { withResourceBindings } from './control-resource-bindings.js?v=3';
import { MAPPING_RESOURCE_DEFINITIONS } from './control-mappings.js';
import { problemsFromSnapshot } from './control-problems.js?v=2';
import { supportPageFrame, supportResourceRows } from './control-support-shared.js?v=3';

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
          Object.freeze({ href: '/commands', label: 'Review moderation commands' }),
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
    intro: 'Get tickets ready, handle them, and recover when something fails.',
    stages: Object.freeze([
      Object.freeze({
        title: 'Prepare',
        body: 'Keep ticket types and Discord resources configured in Tickets before publishing the member entry point.',
        points: Object.freeze([
          'The ticket panel needs an existing ticket panel channel and at least one enabled ticket type.',
          'Each /ticket-panel post invocation sends a new panel message; it does not edit an older one.',
        ]),
        links: Object.freeze([
          Object.freeze({ href: '/control/utilities/ticket-configuration', label: 'Review ticket configuration' }),
          Object.freeze({ href: '/control/mappings/channels', label: 'Check ticket channel mappings' }),
          Object.freeze({ href: '/control/mappings/categories', label: 'Check ticket category mapping' }),
          Object.freeze({ href: '/commands', label: 'Review ticket commands' }),
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
          'Closing hides the channel from the opener, records the closure, prefixes the channel name when possible, and attempts a transcript of up to 500 messages to the ticket log channel.',
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
    intro: 'Publish event announcements and live alerts, then check them in Discord.',
    stages: Object.freeze([
      Object.freeze({
        title: 'Prepare',
        body: 'Verify the feature state and destination before drafting the event communication.',
        points: Object.freeze([
          'Announcements and Live keep their own feature state and show a problem on the channel row when a destination is not ready.',
          'Live needs the Live announcements channel or the fallback Announcements mapping and permission to send messages and embeds.',
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
          Object.freeze({ href: '/commands', label: 'Review publishing commands' }),
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
          'If the optional TikTok URL is not configured, the live announcement can still post without a link button.',
          'If the configured Live Notifications role cannot be mentioned, the live announcement still posts and the invoker is told the ping was skipped.',
        ]),
      }),
    ]),
  }),
});

// Steps that have already had their default state applied. The first step of each playbook starts open once.
const seededSteps = new Set();

function slug(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function stageMarkup(stage, index, config = {}) {
  const id = `playbook-${slug(config.title)}-${index + 1}`;
  if (index === 0 && !seededSteps.has(id)) {
    seededSteps.add(id);
    setDisclosureOpen(id, true);
  }
  const points = (stage.points || []).length
    ? `<ul class="workflow-step-checks">${stage.points.map(point => `<li>${escapeHtml(point)}</li>`).join('')}</ul>`
    : '';
  const links = (stage.links || []).length
    ? `<div class="workflow-links">${stage.links.map(link => `<a class="control-inline-action" href="${escapeHtml(link.href)}" data-nav-path="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a>`).join('')}</div>`
    : '';
  const trigger = `<span class="workflow-step-number" aria-hidden="true">${index + 1}</span><span class="workflow-step-copy"><span class="workflow-step-title">${escapeHtml(stage.title)}</span><span class="workflow-step-summary">${escapeHtml(stage.body)}</span></span>`;
  return `<li class="workflow-step">${disclosure({ id, trigger, body: `${points}${links}`, className: 'workflow-step-disclosure' })}</li>`;
}

function stagesMarkup(config) {
  return `<ol class="workflow-steps">${config.stages.map((stage, index) => stageMarkup(stage, index, config)).join('')}</ol>`;
}

export function workflowPageMarkup(pageKey) {
  const config = WORKFLOW_PAGE_CONFIGS[pageKey];
  if (!config) return '';
  return `
    <article class="control-page workflow-page" data-page-key="${escapeHtml(pageKey)}">
      ${controlSimplePageHeaderMarkup({ title: config.title, description: config.intro })}
      ${stagesMarkup(config)}
    </article>`;
}


// Control redesign completion: Moderation is configurable; other workflows remain guidance-only.
const MODERATION_PAGE = '/control/workflows/moderation';

function moderationEnabled(snapshot) {
  return Boolean((snapshot?.features || []).find(item => item?.name === 'moderation')?.enabled);
}

const TRAP_KEY = 'compromised_account_trap';

function trapChanged(state) {
  const before = state?.persisted?.resourceBindings?.[TRAP_KEY] ?? null;
  const after = state?.draft?.resourceBindings?.[TRAP_KEY] ?? null;
  return after !== null && after !== '' && after !== before;
}

function trapConfirmRow(state) {
  if (!trapChanged(state)) return '';
  return (settingRow({
    label: 'I understand that new human messages in this channel trigger compromised-account enforcement.',
    controlId: 'resource-confirm-trap',
    rowKey: `${TRAP_KEY}:confirm`,
    control: switchMarkup({ id: 'resource-confirm-trap', checked: Boolean(state.draft?.resourceAcknowledgements?.[TRAP_KEY]), attributes: `data-resource-confirm="${TRAP_KEY}"` }),
  }));
}

function moderationMarkup(state, snapshot) {
  const config = WORKFLOW_PAGE_CONFIGS[MODERATION_PAGE];
  const value = state.draft ?? state.persisted;
  const master = settingsRows(masterSwitchRow({
    label: 'Log moderation actions',
    offHint: 'Warn, timeout, kick and ban stop working.',
    checked: value.enabled,
    field: 'enabled',
    attribute: 'data-workflow-enabled',
  }), { label: 'Moderation settings' });
  const problems = problemsFromSnapshot(snapshot).filter(problem => problem.pageKey === MODERATION_PAGE);
  const channels = settingsSection({
    id: 'moderation-resources-heading',
    title: 'Channels',
    body: supportResourceRows({
      snapshot,
      state,
      keys: featureResourceKeys(MODERATION_PAGE),
      problems,
      hints: { [TRAP_KEY]: MAPPING_RESOURCE_DEFINITIONS[TRAP_KEY].warning },
      after: { [TRAP_KEY]: trapConfirmRow(state) },
    }),
  });
  const guide = disclosure({ id: 'moderation-guide', label: 'How moderation works', body: stagesMarkup(config) });
  return supportPageFrame({
    pageKey: MODERATION_PAGE,
    className: 'workflow-page',
    title: config.title,
    enabled: value.enabled,
    body: `${master}${channels}${guide}`,
    state,
    save: 'data-workflow-save',
    discard: 'data-workflow-discard',
  });
}

function createModerationPageDefinition() {
  return {
    pageKey: MODERATION_PAGE,
    editOnMount: true,
    selectPersisted(snapshot) {
      return { enabled: moderationEnabled(snapshot) };
    },
    cloneDraft(value) {
      return { enabled: Boolean(value?.enabled) };
    },
    validateDraft() {
      return {};
    },
    diffDraft(persisted, draft) {
      if (Boolean(persisted?.enabled) === Boolean(draft?.enabled)) return [];
      return [{ action_type: 'set_feature', payload: { feature: 'moderation', enabled: Boolean(draft?.enabled) } }];
    },
    render({ state, snapshot } = {}) {
      const config = WORKFLOW_PAGE_CONFIGS[MODERATION_PAGE];
      if (!state?.persisted) {
        return `<article class="control-page workflow-page">${controlSimplePageHeaderMarkup({ title: config.title })}</article>`;
      }
      return moderationMarkup(state, snapshot || {});
    },
    // Context content now lives in the page as rows, problems and the Channels section.
    renderContext() {
      return '';
    },
    install({ root, store, pageKey, onSave, rerender } = {}) {
      const onClick = event => {
        if (event.target.closest?.('[data-workflow-discard]')) {
          store.discard(pageKey);
          rerender?.();
          return;
        }
        if (event.target.closest?.('[data-workflow-save]') && store.canSave(pageKey)) {
          onSave?.(pageKey, store.buildSaveRequest(pageKey));
        }
      };
      const onChange = event => {
        const toggle = event.target.closest?.('[data-workflow-enabled]');
        if (!toggle) return;
        store.updateDraft(pageKey, draft => { draft.enabled = Boolean(toggle.checked); });
        rerender?.();
      };
      root.addEventListener('click', onClick);
      root.addEventListener('change', onChange);
      return () => {
        root.removeEventListener('click', onClick);
        root.removeEventListener('change', onChange);
      };
    },
  };
}

export function registerWorkflowPages() {
  if (!registeredControlPage(MODERATION_PAGE)) {
    registerControlPage(withResourceBindings(
      createModerationPageDefinition(),
      featureResourceKeys(MODERATION_PAGE),
      { genericContext: 'never' },
    ));
  }
}
