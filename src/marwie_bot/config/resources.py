from __future__ import annotations

from enum import StrEnum


class ResourceKey(StrEnum):
    MODERATION_LOG = "moderation_log"
    MESSAGE_LOG = "message_log"
    TICKET_PANEL = "ticket_panel"
    TICKET_CATEGORY = "ticket_category"
    TICKET_LOGS = "ticket_logs"
    CREATE_WORKSPACE_VOICE = "create_workspace_voice"
    TEMP_VOICE_CATEGORY = "temp_voice_category"
    COWORKING_LOUNGE = "coworking_lounge"
    ANNOUNCEMENTS = "announcements"
    LIVE_ANNOUNCEMENTS = "live_announcements"
    LIVE_PING_ROLE = "live_ping_role"
    ROLE_PANEL = "role_panel"
    AI_UPDATES = "ai_updates"
    QUIZ_CHANNEL = "quiz_channel"
    ANON_QUESTIONS = "anon_questions"
    ANON_MESSAGES_PANEL = "anon_messages_panel"
    ANON_MESSAGES_SUBMISSIONS = "anon_messages_submissions"
    ANON_MESSAGES_AUDIT_LOG = "anon_messages_audit_log"
    ANALYTICS = "analytics"
    SHOWCASE_FORUM = "showcase_forum"
    APP_OF_WEEK = "app_of_the_week"
    COLLAB_LFG = "collab_lfg"
    BUILDER_ROLE = "builder_role"
    CONTRIBUTOR_ROLE = "contributor_role"
    MENTOR_ROLE = "mentor_role"
    COMPROMISED_ACCOUNT_TRAP = "compromised_account_trap"
    BOT_LOG = "bot_log"


class ResourceType(StrEnum):
    CHANNEL = "channel"
    CATEGORY = "category"
    ROLE = "role"
    FORUM_TAG = "forum_tag"


class FeatureName(StrEnum):
    MODERATION = "moderation"
    MESSAGE_LOGS = "message_logs"
    TICKETS = "tickets"
    VOICE = "voice"
    ANNOUNCEMENTS = "announcements"
    LIVE_ANNOUNCEMENTS = "live_announcements"
    REPUTATION = "reputation"
    QUIZZES = "quizzes"
    ANONYMOUS_QUESTIONS = "anonymous_questions"
    ANONYMOUS_MESSAGES = "anonymous_messages"
    COWORKING = "coworking"
    AI_UPDATES = "ai_updates"
    ANALYTICS = "analytics"
    SHOWCASE = "showcase"


RESOURCE_TYPES: dict[ResourceKey, ResourceType] = {
    ResourceKey.MODERATION_LOG: ResourceType.CHANNEL,
    ResourceKey.MESSAGE_LOG: ResourceType.CHANNEL,
    ResourceKey.TICKET_PANEL: ResourceType.CHANNEL,
    ResourceKey.TICKET_CATEGORY: ResourceType.CATEGORY,
    ResourceKey.TICKET_LOGS: ResourceType.CHANNEL,
    ResourceKey.CREATE_WORKSPACE_VOICE: ResourceType.CHANNEL,
    ResourceKey.TEMP_VOICE_CATEGORY: ResourceType.CATEGORY,
    ResourceKey.COWORKING_LOUNGE: ResourceType.CHANNEL,
    ResourceKey.ANNOUNCEMENTS: ResourceType.CHANNEL,
    ResourceKey.LIVE_ANNOUNCEMENTS: ResourceType.CHANNEL,
    ResourceKey.LIVE_PING_ROLE: ResourceType.ROLE,
    ResourceKey.ROLE_PANEL: ResourceType.CHANNEL,
    ResourceKey.AI_UPDATES: ResourceType.CHANNEL,
    ResourceKey.QUIZ_CHANNEL: ResourceType.CHANNEL,
    ResourceKey.ANON_QUESTIONS: ResourceType.CHANNEL,
    ResourceKey.ANON_MESSAGES_PANEL: ResourceType.CHANNEL,
    ResourceKey.ANON_MESSAGES_SUBMISSIONS: ResourceType.CHANNEL,
    ResourceKey.ANON_MESSAGES_AUDIT_LOG: ResourceType.CHANNEL,
    ResourceKey.ANALYTICS: ResourceType.CHANNEL,
    ResourceKey.SHOWCASE_FORUM: ResourceType.CHANNEL,
    ResourceKey.APP_OF_WEEK: ResourceType.CHANNEL,
    ResourceKey.COLLAB_LFG: ResourceType.CHANNEL,
    ResourceKey.BUILDER_ROLE: ResourceType.ROLE,
    ResourceKey.CONTRIBUTOR_ROLE: ResourceType.ROLE,
    ResourceKey.MENTOR_ROLE: ResourceType.ROLE,
    ResourceKey.COMPROMISED_ACCOUNT_TRAP: ResourceType.CHANNEL,
    ResourceKey.BOT_LOG: ResourceType.CHANNEL,
}
