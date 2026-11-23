import { controlState } from '../../docs-site/control-page-registry.js';
import { registerContentPages } from '../../docs-site/control-content.js';
import { registerUtilitiesPages } from '../../docs-site/control-utilities.js';
import { registerWorkflowPages } from '../../docs-site/control-workflows.js';
import { controlRouteSnapshot } from './control-route-snapshot.js';

export const FEEDS = '/control/content/feeds';
export const ANNOUNCEMENTS = '/control/content/announcements';
export const LIVE = '/control/content/live';
export const TICKETS = '/control/utilities/ticket-configuration';
export const NOTIFICATIONS = '/control/utilities/notification-roles';
export const ANONYMOUS = '/control/utilities/anonymous-questions';
export const MODERATION = '/control/workflows/moderation';
export const STAGE_2B_PAGES = [FEEDS, ANNOUNCEMENTS, LIVE, TICKETS, NOTIFICATIONS, ANONYMOUS, MODERATION];

export function stage2bSnapshot() {
  const snapshot = controlRouteSnapshot();
  snapshot.channels.push(
    { id: '260', name: 'general', kind: 'text', category_id: null, send_messages: true, embed_links: true },
    { id: '261', name: 'mod-chat', kind: 'text', category_id: null, send_messages: true, embed_links: true },
    { id: '231', name: 'ticket-logs', kind: 'text', category_id: null, send_messages: true, embed_links: true },
    { id: '240', name: 'moderation-log', kind: 'text', category_id: null, send_messages: true, embed_links: true },
    { id: '241', name: 'trap-channel', kind: 'text', category_id: null, send_messages: true, embed_links: true },
  );
  snapshot.categories.push({ id: '262', name: 'Support' });
  snapshot.channels.push({ id: '262', name: 'Support', kind: 'category', category_id: null, send_messages: false, embed_links: false });
  snapshot.channels.push({ id: '232', name: 'Tickets', kind: 'category', category_id: null, send_messages: false, embed_links: false });
  return snapshot;
}

// Registers every Stage 2b page in the shared store and hydrates it from one snapshot.
export function hydrateStage2b(snapshot = stage2bSnapshot()) {
  registerContentPages();
  registerUtilitiesPages();
  registerWorkflowPages();
  for (const pageKey of STAGE_2B_PAGES) {
    controlState.hydrate(pageKey, snapshot, 'a'.repeat(64));
    if (controlState.get(pageKey).mode !== 'edit') controlState.beginEdit(pageKey);
  }
  return snapshot;
}

function request(pageKey, edit) {
  controlState.discard(pageKey);
  controlState.updateDraft(pageKey, edit);
  return controlState.buildSaveRequest(pageKey);
}

// Identical draft edits per page, through the real store. Expected JSON was captured before the Stage 2b rewrite.
export function stage2bSaveRequests() {
  hydrateStage2b();
  const out = {};
  out.feeds = request(FEEDS, draft => {
    draft.enabled = false;
    draft.sources[0].name = 'OpenAI blog';
    draft.sources[1].enabled = true;
    draft.sources.push({ id: null, localId: 'new-test', name: 'Lab', url: 'https://example.com/lab.xml', category: 'Labs', enabled: true });
    draft.resourceBindings.ai_updates = '260';
  });
  out.feedsDisableExisting = request(FEEDS, draft => {
    draft.sources[0].enabled = false;
    draft.sources[0].url = 'https://example.com/changed.xml';
  });
  out.announcements = request(ANNOUNCEMENTS, draft => {
    draft.enabled = false;
    draft.resourceBindings.announcements = '260';
  });
  out.live = request(LIVE, draft => {
    draft.enabled = false;
    draft.resourceBindings.live_announcements = '260';
    draft.resourceBindings.live_ping_role = null;
  });
  out.tickets = request(TICKETS, draft => {
    draft.enabled = false;
    draft.ticket_types[0].label = 'Help';
    draft.ticket_types[1].enabled = true;
    draft.ticket_types.push({ key: 'general', label: 'General', description: 'General support', enabled: true, isNew: true });
    draft.resourceBindings.ticket_panel = '260';
    draft.resourceBindings.ticket_category = '262';
    draft.resourceBindings.ticket_logs = null;
  });
  out.ticketsDisable = request(TICKETS, draft => { draft.ticket_types[0].enabled = false; });
  out.notifications = request(NOTIFICATIONS, draft => {
    draft.title = 'Pick your updates';
    draft.description = 'Choose what you want.';
    draft.buttons[0].emoji = '';
    draft.buttons[1].style = 'success';
    draft.buttons.push({ role_id: '201', label: 'Builders', emoji: '', style: 'primary' });
    draft.resourceBindings.role_panel = '260';
  });
  out.anonymous = request(ANONYMOUS, draft => {
    draft.enabled = false;
    draft.resourceBindings.anon_questions = '260';
  });
  out.moderation = request(MODERATION, draft => {
    draft.enabled = false;
    draft.resourceBindings.moderation_log = '261';
    draft.resourceBindings.compromised_account_trap = '260';
    draft.resourceAcknowledgements.compromised_account_trap = true;
  });
  for (const pageKey of STAGE_2B_PAGES) controlState.discard(pageKey);
  return JSON.parse(JSON.stringify(out));
}
