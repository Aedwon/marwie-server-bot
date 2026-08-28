const PAGE_LABELS = Object.freeze({
  '/control/community/reputation': 'Reputation',
  '/control/community/quizzes': 'Quizzes',
  '/control/community/voice-coworking': 'Voice & Coworking',
  '/control/community/showcase': 'Showcase',
  '/control/content/feeds': 'Feeds',
  '/control/content/announcements': 'Announcements',
  '/control/content/live': 'Live',
  '/control/utilities/ticket-configuration': 'Ticket configuration',
  '/control/utilities/notification-roles': 'Notification roles',
  '/control/utilities/anonymous-questions': 'Anonymous Questions',
  '/control/analytics': 'Analytics',
  '/control/workflows/moderation': 'Moderation',
  '/control/workflows/ticket-handling': 'Ticket handling',
  '/control/workflows/events': 'Events',
  '/control/mappings/channels': 'Channel mappings',
  '/control/mappings/roles': 'Role mappings',
  '/control/mappings/categories': 'Category mappings',
});

const ACTION_SUMMARIES = Object.freeze({
  set_resource: 'Updated a Discord mapping',
  clear_resource: 'Cleared a Discord mapping',
  apply_auto_setup: 'Applied suggested server setup',
  set_feature: 'Changed feature availability',
  set_log_exclusions: 'Updated message log exclusions',
  save_notification_panel: 'Updated notification roles',
  upsert_ticket_type: 'Updated a ticket type',
  disable_ticket_type: 'Disabled a ticket type',
  refresh_ticket_panel: 'Refreshed the ticket panel',
  set_reputation_thresholds: 'Updated reputation thresholds',
  adjust_reputation: 'Adjusted member reputation',
  set_quiz_schedule: 'Updated quiz scheduling',
  add_quiz_question: 'Added a quiz question',
  upsert_ai_source: 'Updated an AI feed source',
  disable_ai_source: 'Disabled an AI feed source',
  poll_ai_sources: 'Ran manual AI feed polling',
  send_announcement: 'Sent an announcement',
  post_live: 'Posted a live announcement',
});

export function activitySummary(row) {
  if (row.action_type === 'save_page') {
    const pageKey = String(row.payload_json?.page_key || '');
    return `Saved ${PAGE_LABELS[pageKey] || 'Control page'} settings`;
  }
  return ACTION_SUMMARIES[row.action_type] || 'Performed a Control action';
}

export function activityProjection(row) {
  return {
    id: String(row.id),
    actor: { id: String(row.actor_id) },
    action_type: String(row.action_type),
    summary: activitySummary(row),
    status: String(row.status),
    timestamp: row.finished_at || row.created_at,
    failure: row.user_error ? {
      message: String(row.user_error),
      reference: row.error_reference ? String(row.error_reference) : null,
    } : null,
  };
}

export function encodeActivityCursor(createdAt, id) {
  return Buffer.from(JSON.stringify({ created_at: String(createdAt), id: String(id) }), 'utf8').toString('base64url');
}

export function decodeActivityCursor(value) {
  let data;
  try {
    data = JSON.parse(Buffer.from(String(value || ''), 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid Activity cursor.');
  }
  if (!data || typeof data !== 'object' || !data.created_at || !/^[0-9a-f]{32}$/i.test(String(data.id || ''))) {
    throw new Error('Invalid Activity cursor.');
  }
  const time = new Date(data.created_at).getTime();
  if (!Number.isFinite(time)) throw new Error('Invalid Activity cursor.');
  return { created_at: String(data.created_at), id: String(data.id) };
}
