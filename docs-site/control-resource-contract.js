export const FEATURE_RESOURCE_KEYS_BY_PAGE = Object.freeze({
  '/control/community/reputation': Object.freeze(['builder_role', 'contributor_role', 'mentor_role']),
  '/control/community/quizzes': Object.freeze(['quiz_channel']),
  '/control/community/voice-coworking': Object.freeze(['create_workspace_voice', 'coworking_lounge', 'temp_voice_category']),
  '/control/community/showcase': Object.freeze(['showcase_forum', 'app_of_the_week', 'collab_lfg']),
  '/control/utilities/notification-roles': Object.freeze(['role_panel']),
  '/control/content/feeds': Object.freeze(['ai_updates']),
  '/control/content/announcements': Object.freeze(['announcements']),
  '/control/content/live': Object.freeze(['live_announcements', 'live_ping_role']),
  '/control/utilities/ticket-configuration': Object.freeze(['ticket_panel', 'ticket_logs', 'ticket_category']),
  '/control/utilities/anonymous-questions': Object.freeze(['anon_questions']),
  '/control/workflows/moderation': Object.freeze(['moderation_log', 'compromised_account_trap']),
  '/control/analytics': Object.freeze(['analytics']),
});

export function featureResourceKeys(pageKey) {
  return FEATURE_RESOURCE_KEYS_BY_PAGE[pageKey] || Object.freeze([]);
}

export function featureOwnsResource(pageKey, resourceKey) {
  return featureResourceKeys(pageKey).includes(String(resourceKey || ''));
}
