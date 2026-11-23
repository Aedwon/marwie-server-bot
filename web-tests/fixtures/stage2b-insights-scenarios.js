import { controlState } from '../../docs-site/control-page-registry.js';
import { registerAnalyticsPage } from '../../docs-site/control-analytics.js';
import { registerMappingPages } from '../../docs-site/control-mappings.js';
import { controlRouteSnapshot } from './control-route-snapshot.js';

export const ANALYTICS = '/control/analytics';
export const CHANNELS = '/control/mappings/channels';
export const ROLES = '/control/mappings/roles';
export const CATEGORIES = '/control/mappings/categories';

export function insightsSnapshot() {
  const snapshot = controlRouteSnapshot();
  snapshot.channels.push(
    { id: '260', name: 'general', kind: 'text', category_id: null, send_messages: true, embed_links: true },
    { id: '241', name: 'trap-channel', kind: 'text', category_id: null, send_messages: true, embed_links: true },
    { id: '262', name: 'Support', kind: 'category', category_id: null, send_messages: false, embed_links: false },
    { id: '232', name: 'Tickets', kind: 'category', category_id: null, send_messages: false, embed_links: false },
  );
  return snapshot;
}

function request(pageKey, edit) {
  controlState.discard(pageKey);
  controlState.updateDraft(pageKey, edit);
  return controlState.buildSaveRequest(pageKey);
}

// Identical draft edits through the real store. Expected JSON was captured before the Stage 2b rewrite.
export function insightsSaveRequests() {
  registerAnalyticsPage();
  registerMappingPages();
  const snapshot = insightsSnapshot();
  for (const pageKey of [ANALYTICS, CHANNELS, ROLES, CATEGORIES]) {
    controlState.hydrate(pageKey, snapshot, 'b'.repeat(64));
    if (controlState.get(pageKey).mode !== 'edit') controlState.beginEdit(pageKey);
  }
  const out = {};
  out.analytics = request(ANALYTICS, draft => {
    draft.enabled = false;
    draft.resourceBindings.analytics = '260';
  });
  out.channels = request(CHANNELS, draft => {
    draft.quiz_channel = '260';
    draft.moderation_log = null;
    draft.analytics = '221';
  });
  out.roles = request(ROLES, draft => { draft.live_ping_role = '201'; draft.mentor_role = null; });
  out.categories = request(CATEGORIES, draft => { draft.ticket_category = '262'; });
  return JSON.parse(JSON.stringify(out));
}
