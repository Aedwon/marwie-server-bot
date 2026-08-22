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
    AI_UPDATES = "ai_updates"
    BUILD_HELP_FORUM = "build_help_forum"
    SOLVED_TAG = "solved_tag"
    QUIZ_CHANNEL = "quiz_channel"
    ANON_QUESTIONS = "anon_questions"
    ANALYTICS = "analytics"
    SHOWCASE_FORUM = "showcase_forum"
    APP_OF_WEEK = "app_of_the_week"
    COLLAB_LFG = "collab_lfg"
    BUILDER_ROLE = "builder_role"
    CONTRIBUTOR_ROLE = "contributor_role"
    MENTOR_ROLE = "mentor_role"
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
    REPUTATION = "reputation"
    BUILD_HELP = "build_help"
    QUIZZES = "quizzes"
    ANONYMOUS_QUESTIONS = "anonymous_questions"
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
    ResourceKey.AI_UPDATES: ResourceType.CHANNEL,
    ResourceKey.BUILD_HELP_FORUM: ResourceType.CHANNEL,
    ResourceKey.SOLVED_TAG: ResourceType.FORUM_TAG,
    ResourceKey.QUIZ_CHANNEL: ResourceType.CHANNEL,
    ResourceKey.ANON_QUESTIONS: ResourceType.CHANNEL,
    ResourceKey.ANALYTICS: ResourceType.CHANNEL,
    ResourceKey.SHOWCASE_FORUM: ResourceType.CHANNEL,
    ResourceKey.APP_OF_WEEK: ResourceType.CHANNEL,
    ResourceKey.COLLAB_LFG: ResourceType.CHANNEL,
    ResourceKey.BUILDER_ROLE: ResourceType.ROLE,
    ResourceKey.CONTRIBUTOR_ROLE: ResourceType.ROLE,
    ResourceKey.MENTOR_ROLE: ResourceType.ROLE,
    ResourceKey.BOT_LOG: ResourceType.CHANNEL,
}
