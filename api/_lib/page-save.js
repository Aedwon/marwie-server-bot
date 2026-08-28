const MAX_CHANGES = 50;
const MAX_PAYLOAD_BYTES = 64 * 1024;

export const PAGE_SAVE_ACTIONS_BY_PAGE = Object.freeze({
  '/control/community/reputation': Object.freeze(['set_feature', 'set_reputation_thresholds']),
  '/control/community/quizzes': Object.freeze(['set_feature', 'set_quiz_schedule', 'add_quiz_question']),
  '/control/community/voice-coworking': Object.freeze(['set_feature']),
  '/control/community/showcase': Object.freeze(['set_feature']),
  '/control/content/feeds': Object.freeze(['set_feature', 'upsert_ai_source', 'disable_ai_source']),
  '/control/content/announcements': Object.freeze(['set_feature']),
  '/control/content/live': Object.freeze(['set_feature']),
  '/control/utilities/ticket-configuration': Object.freeze(['set_feature', 'upsert_ticket_type', 'disable_ticket_type']),
  '/control/utilities/notification-roles': Object.freeze(['save_notification_panel']),
  '/control/utilities/anonymous-questions': Object.freeze(['set_feature']),
  '/control/analytics': Object.freeze(['set_feature']),
  '/control/workflows/moderation': Object.freeze(['set_feature']),
  '/control/workflows/ticket-handling': Object.freeze([]),
  '/control/workflows/events': Object.freeze([]),
  '/control/mappings/channels': Object.freeze(['set_resource', 'clear_resource']),
  '/control/mappings/roles': Object.freeze(['set_resource', 'clear_resource']),
  '/control/mappings/categories': Object.freeze(['set_resource', 'clear_resource']),
});

const FEATURE_OWNER = Object.freeze({
  '/control/community/reputation': new Set(['reputation']),
  '/control/community/quizzes': new Set(['quizzes']),
  '/control/community/voice-coworking': new Set(['voice', 'coworking']),
  '/control/community/showcase': new Set(['showcase']),
  '/control/content/feeds': new Set(['ai_updates']),
  '/control/content/announcements': new Set(['announcements']),
  '/control/content/live': new Set(['live_announcements']),
  '/control/utilities/ticket-configuration': new Set(['tickets']),
  '/control/utilities/anonymous-questions': new Set(['anonymous_questions']),
  '/control/analytics': new Set(['analytics']),
  '/control/workflows/moderation': new Set(['moderation']),
});

const ROLE_RESOURCE_KEYS = new Set([
  'live_ping_role', 'builder_role', 'contributor_role', 'mentor_role',
]);
const CATEGORY_RESOURCE_KEYS = new Set(['ticket_category', 'temp_voice_category']);
const CHANNEL_RESOURCE_KEYS = new Set([
  'moderation_log', 'ticket_panel', 'ticket_logs', 'create_workspace_voice', 'coworking_lounge',
  'announcements', 'live_announcements', 'role_panel', 'ai_updates', 'quiz_channel',
  'anon_questions', 'analytics', 'showcase_forum', 'app_of_the_week', 'collab_lfg', 'bot_log',
]);


function canonicalJsonValue(value) {
  if (Array.isArray(value)) return value.map(canonicalJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, canonicalJsonValue(value[key])]),
  );
}

export function pageSavePayloadMatches(left, right) {
  return JSON.stringify(canonicalJsonValue(left)) === JSON.stringify(canonicalJsonValue(right));
}

function mapping(value, field, HttpError) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, `${field} must be an object.`);
  }
  return value;
}

function requireOwnership(pageKey, actionType, payload, HttpError) {
  const allowed = PAGE_SAVE_ACTIONS_BY_PAGE[pageKey];
  if (!allowed || !allowed.includes(actionType)) {
    throw new HttpError(400, 'That change does not belong to this Control page.');
  }

  if (actionType === 'set_feature') {
    const owners = FEATURE_OWNER[pageKey];
    if (!owners?.has(String(payload.feature || ''))) {
      throw new HttpError(400, 'That feature is owned by a different Control page.');
    }
  }

  if (actionType === 'set_resource' || actionType === 'clear_resource') {
    const key = String(payload.key || '');
    const expected = pageKey === '/control/mappings/roles'
      ? ROLE_RESOURCE_KEYS
      : pageKey === '/control/mappings/categories'
        ? CATEGORY_RESOURCE_KEYS
        : CHANNEL_RESOURCE_KEYS;
    if (!expected.has(key)) {
      throw new HttpError(400, 'That Discord mapping is not owned by this Mappings page.');
    }
  }
}

export function validatePageSavePayload(rawPayload, dependencies) {
  const { normalizeActionType, validateActionPayload, HttpError } = dependencies;
  const data = mapping(rawPayload, 'Page save payload', HttpError);
  let serialized;
  try {
    serialized = JSON.stringify(data);
  } catch {
    throw new HttpError(400, 'Page save payload must be valid JSON data.');
  }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_PAYLOAD_BYTES) {
    throw new HttpError(400, `Page save payload must be at most ${MAX_PAYLOAD_BYTES} bytes.`);
  }

  const pageKey = String(data.page_key || '').trim();
  if (!Object.hasOwn(PAGE_SAVE_ACTIONS_BY_PAGE, pageKey)) {
    throw new HttpError(400, 'Unknown Control page.');
  }
  const baseRevision = String(data.base_revision || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(baseRevision)) {
    throw new HttpError(400, 'Page revision must be a SHA-256 value.');
  }
  if (!Array.isArray(data.changes) || data.changes.length < 1 || data.changes.length > MAX_CHANGES) {
    throw new HttpError(400, `Page save requires between 1 and ${MAX_CHANGES} changes.`);
  }

  const changes = data.changes.map((raw, index) => {
    const change = mapping(raw, `Change ${index + 1}`, HttpError);
    const actionType = normalizeActionType(change.action_type);
    if (actionType === 'save_page' || actionType === 'refresh_snapshot') {
      throw new HttpError(400, 'Nested internal control actions are not allowed.');
    }
    const payload = validateActionPayload(actionType, change.payload || {});
    requireOwnership(pageKey, actionType, payload, HttpError);
    return { action_type: actionType, payload };
  });

  return { page_key: pageKey, base_revision: baseRevision, changes };
}
