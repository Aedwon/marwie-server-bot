import { guildIsAdministrator, HttpError } from './control.js';

export const ACTIONS = Object.freeze({
  SET_RESOURCE: 'set_resource',
  CLEAR_RESOURCE: 'clear_resource',
  APPLY_AUTO_SETUP: 'apply_auto_setup',
  SET_FEATURE: 'set_feature',
  SET_LOG_EXCLUSIONS: 'set_log_exclusions',
  SAVE_NOTIFICATION_PANEL: 'save_notification_panel',
  UPSERT_TICKET_TYPE: 'upsert_ticket_type',
  DISABLE_TICKET_TYPE: 'disable_ticket_type',
  REFRESH_TICKET_PANEL: 'refresh_ticket_panel',
  SET_REPUTATION_THRESHOLDS: 'set_reputation_thresholds',
  ADJUST_REPUTATION: 'adjust_reputation',
  SET_QUIZ_SCHEDULE: 'set_quiz_schedule',
  ADD_QUIZ_QUESTION: 'add_quiz_question',
  UPSERT_AI_SOURCE: 'upsert_ai_source',
  DISABLE_AI_SOURCE: 'disable_ai_source',
  POLL_AI_SOURCES: 'poll_ai_sources',
  SEND_ANNOUNCEMENT: 'send_announcement',
  POST_LIVE: 'post_live',
});

const ACTION_VALUES = new Set(Object.values(ACTIONS));
const ADMIN_ACTIONS = new Set([
  ACTIONS.SET_RESOURCE,
  ACTIONS.CLEAR_RESOURCE,
  ACTIONS.APPLY_AUTO_SETUP,
  ACTIONS.SET_FEATURE,
  ACTIONS.SET_LOG_EXCLUSIONS,
  ACTIONS.SAVE_NOTIFICATION_PANEL,
  ACTIONS.UPSERT_TICKET_TYPE,
  ACTIONS.DISABLE_TICKET_TYPE,
  ACTIONS.REFRESH_TICKET_PANEL,
  ACTIONS.POST_LIVE,
]);

const RESOURCE_KEYS = new Set([
  'moderation_log', 'message_log', 'ticket_panel', 'ticket_category', 'ticket_logs',
  'create_workspace_voice', 'temp_voice_category', 'coworking_lounge', 'announcements',
  'live_announcements', 'live_ping_role', 'role_panel', 'ai_updates', 'build_help_forum',
  'solved_tag', 'quiz_channel', 'anon_questions', 'analytics', 'showcase_forum',
  'app_of_the_week', 'collab_lfg', 'builder_role', 'contributor_role', 'mentor_role', 'bot_log',
]);

const FEATURE_NAMES = new Set([
  'moderation', 'message_logs', 'tickets', 'voice', 'announcements', 'live_announcements',
  'reputation', 'build_help', 'quizzes', 'anonymous_questions', 'coworking', 'ai_updates',
  'analytics', 'showcase',
]);

function object(value, field = 'Payload') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, `${field} must be an object.`);
  }
  return value;
}

function text(value, field, maxLength, { required = true } = {}) {
  const result = String(value ?? '').trim();
  if (required && !result) throw new HttpError(400, `${field} is required.`);
  if (result.length > maxLength) throw new HttpError(400, `${field} must be at most ${maxLength} characters.`);
  return result;
}

function integer(value, field, min, max) {
  const result = Number(value);
  if (!Number.isInteger(result)) throw new HttpError(400, `${field} must be a whole number.`);
  if (result < min || result > max) throw new HttpError(400, `${field} must be between ${min} and ${max}.`);
  return result;
}

function snowflake(value, field) {
  const raw = String(value ?? '').trim();
  if (!/^\d{1,20}$/.test(raw) || raw === '0') throw new HttpError(400, `${field} must be a Discord ID.`);
  return raw;
}

function optionalSnowflake(value, field) {
  if (value === null || value === undefined || value === '') return null;
  return snowflake(value, field);
}

function uniqueSnowflakes(values, field, limit) {
  if (!Array.isArray(values)) throw new HttpError(400, `${field} must be a list.`);
  const result = [...new Set(values.map((value) => snowflake(value, field)))];
  if (result.length > limit) throw new HttpError(400, `${field} supports at most ${limit} entries.`);
  return result;
}

function mentions(value) {
  const data = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    everyone: Boolean(data.everyone),
    here: Boolean(data.here),
    role_ids: uniqueSnowflakes(data.role_ids || [], 'Mention roles', 20),
    user_ids: uniqueSnowflakes(data.user_ids || [], 'Mention users', 20),
  };
}

export function normalizeActionType(value) {
  const action = String(value || '');
  if (!ACTION_VALUES.has(action)) throw new HttpError(400, 'Unsupported control action.');
  return action;
}

export function requireBrowserPermission(guild, actionType) {
  if (ADMIN_ACTIONS.has(actionType) && !guildIsAdministrator(guild)) {
    throw new HttpError(403, 'Administrator permission is required for that action.');
  }
}

export function validateActionPayload(actionType, rawPayload) {
  const data = object(rawPayload || {});

  switch (actionType) {
    case ACTIONS.SET_RESOURCE: {
      const key = text(data.key, 'Resource key', 100);
      if (!RESOURCE_KEYS.has(key)) throw new HttpError(400, 'Unknown resource key.');
      return { key, discord_id: snowflake(data.discord_id, 'Resource') };
    }
    case ACTIONS.CLEAR_RESOURCE: {
      const key = text(data.key, 'Resource key', 100);
      if (!RESOURCE_KEYS.has(key)) throw new HttpError(400, 'Unknown resource key.');
      return { key };
    }
    case ACTIONS.APPLY_AUTO_SETUP: {
      const planHash = text(data.plan_hash, 'Setup plan', 128);
      if (!/^[0-9a-f]{64}$/i.test(planHash)) throw new HttpError(400, 'Setup plan is invalid.');
      return { plan_hash: planHash.toLowerCase() };
    }
    case ACTIONS.SET_FEATURE: {
      const feature = text(data.feature, 'Feature', 100);
      if (!FEATURE_NAMES.has(feature)) throw new HttpError(400, 'Unknown feature.');
      if (typeof data.enabled !== 'boolean') throw new HttpError(400, 'Enabled must be true or false.');
      return { feature, enabled: data.enabled };
    }
    case ACTIONS.SET_LOG_EXCLUSIONS:
      return { channel_ids: uniqueSnowflakes(data.channel_ids || [], 'Log exclusions', 100) };
    case ACTIONS.SAVE_NOTIFICATION_PANEL: {
      if (!Array.isArray(data.buttons) || data.buttons.length < 1 || data.buttons.length > 25) {
        throw new HttpError(400, 'Use between 1 and 25 notification role buttons.');
      }
      const seen = new Set();
      const buttons = data.buttons.map((raw, index) => {
        const button = object(raw, `Button ${index + 1}`);
        const roleId = snowflake(button.role_id, `Button ${index + 1} role`);
        if (seen.has(roleId)) throw new HttpError(400, 'Notification role panel contains a duplicate role.');
        seen.add(roleId);
        const style = text(button.style || 'primary', 'Button style', 16).toLowerCase();
        if (!['primary', 'secondary', 'success', 'danger'].includes(style)) {
          throw new HttpError(400, 'Notification button style is invalid.');
        }
        return {
          role_id: roleId,
          label: text(button.label, 'Button label', 80),
          emoji: text(button.emoji, 'Button emoji', 32, { required: false }),
          style,
        };
      });
      return {
        channel_id: snowflake(data.channel_id, 'Panel channel'),
        title: text(data.title, 'Panel title', 256),
        description: text(data.description, 'Panel description', 2000),
        buttons,
      };
    }
    case ACTIONS.UPSERT_TICKET_TYPE: {
      const key = text(data.key, 'Ticket type key', 32).toLowerCase();
      if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(key)) {
        throw new HttpError(400, 'Ticket type key must use lowercase letters, numbers, _ or -.');
      }
      return {
        key,
        label: text(data.label, 'Ticket type label', 80),
        description: text(data.description, 'Ticket type description', 200),
      };
    }
    case ACTIONS.DISABLE_TICKET_TYPE:
      return { key: text(data.key, 'Ticket type key', 32).toLowerCase() };
    case ACTIONS.REFRESH_TICKET_PANEL:
    case ACTIONS.POLL_AI_SOURCES:
      return {};
    case ACTIONS.SET_REPUTATION_THRESHOLDS: {
      const builder = integer(data.builder, 'Builder threshold', 1, 100000);
      const contributor = integer(data.contributor, 'Contributor threshold', 1, 100000);
      const mentor = integer(data.mentor, 'Mentor threshold', 1, 100000);
      if (!(builder < contributor && contributor < mentor)) {
        throw new HttpError(400, 'Thresholds must increase from Builder to Contributor to Mentor.');
      }
      return { builder, contributor, mentor };
    }
    case ACTIONS.ADJUST_REPUTATION: {
      const points = integer(data.points, 'Reputation points', -1000, 1000);
      if (points === 0) throw new HttpError(400, 'Reputation points cannot be zero.');
      return {
        member_id: snowflake(data.member_id, 'Member'),
        points,
        reason: text(data.reason, 'Reason', 200),
      };
    }
    case ACTIONS.SET_QUIZ_SCHEDULE:
      return { interval_hours: integer(data.interval_hours, 'Quiz interval', 1, 720) };
    case ACTIONS.ADD_QUIZ_QUESTION: {
      if (!Array.isArray(data.options) || data.options.length !== 4) {
        throw new HttpError(400, 'Quiz questions require exactly four options.');
      }
      return {
        category: text(data.category, 'Category', 50),
        prompt: text(data.prompt, 'Prompt', 2000),
        options: data.options.map((option, index) => text(option, `Option ${index + 1}`, 300)),
        correct: integer(data.correct, 'Correct answer', 1, 4),
        explanation: text(data.explanation, 'Explanation', 2000, { required: false }),
      };
    }
    case ACTIONS.UPSERT_AI_SOURCE: {
      const url = text(data.url, 'Source URL', 1000);
      let parsed;
      try {
        parsed = new URL(url);
      } catch {
        throw new HttpError(400, 'Source URL must be HTTP or HTTPS.');
      }
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new HttpError(400, 'Source URL must be HTTP or HTTPS.');
      const result = {
        name: text(data.name, 'Source name', 100),
        url,
        category: text(data.category, 'Source category', 50),
      };
      if (data.source_id !== null && data.source_id !== undefined && data.source_id !== '') {
        result.source_id = integer(data.source_id, 'Source ID', 1, 2147483647);
      }
      return result;
    }
    case ACTIONS.DISABLE_AI_SOURCE:
      return { source_id: integer(data.source_id, 'Source ID', 1, 2147483647) };
    case ACTIONS.SEND_ANNOUNCEMENT: {
      const color = text(data.color || '5865F2', 'Embed color', 7).replace(/^#/, '').toUpperCase();
      if (!/^[0-9A-F]{6}$/.test(color)) throw new HttpError(400, 'Color must be a six-digit hex value such as 5865F2.');
      return {
        channel_id: snowflake(data.channel_id, 'Announcement channel'),
        message: text(data.message, 'Message', 2000, { required: false }),
        title: text(data.title, 'Title', 256, { required: false }),
        body: text(data.body, 'Announcement body', 4000),
        footer: text(data.footer, 'Footer', 2048, { required: false }),
        color,
        mentions: mentions(data.mentions),
      };
    }
    case ACTIONS.POST_LIVE:
      return {
        channel_id: optionalSnowflake(data.channel_id, 'Live channel'),
        ping_role_id: optionalSnowflake(data.ping_role_id, 'Live ping role'),
        topic: text(data.topic, 'Topic', 500, { required: false }),
      };
    default:
      throw new HttpError(400, 'Unsupported control action.');
  }
}
