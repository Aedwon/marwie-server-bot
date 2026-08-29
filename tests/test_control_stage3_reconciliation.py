from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _text(path: str) -> str:
    return (ROOT / path).read_text()


def test_stage3_executor_is_single_union_module() -> None:
    executor = _text("src/marwie_bot/features/control_plane/executor.py")
    assert not (ROOT / "src/marwie_bot/features/control_plane/executor_base.py").exists()
    for token in (
        "UPDATE_QUIZ_QUESTION",
        "SET_QUIZ_QUESTION_ENABLED",
        "POLL_AI_SOURCES",
        "ResourceKey.ANNOUNCEMENTS",
        "ResourceKey.LIVE_ANNOUNCEMENTS",
        "ResourceKey.LIVE_PING_ROLE",
        "SAVE_NOTIFICATION_PANEL",
        "ResourceKey.ROLE_PANEL",
    ):
        assert token in executor


def test_stage3_page_save_contract_unions_community_and_utilities_without_commands_only_actions() -> (
    None
):
    contract = _text("src/marwie_bot/features/control_plane/page_save_contract.py")
    for token in (
        '"/control/community/quizzes"',
        '"set_quiz_schedule"',
        '"add_quiz_question"',
        '"update_quiz_question"',
        '"set_quiz_question_enabled"',
        '"/control/utilities/notification-roles"',
        '"save_notification_panel"',
    ):
        assert token in contract
    for forbidden in ('"adjust_reputation"', '"refresh_ticket_panel"', '"poll_ai_sources"'):
        assert forbidden not in contract


def test_notification_roles_page_save_remains_destination_free_and_late_bound() -> None:
    contract = _text("src/marwie_bot/features/control_plane/page_save_contract.py")
    page_save = _text("src/marwie_bot/features/control_plane/page_save_executor.py")
    executor = _text("src/marwie_bot/features/control_plane/executor.py")
    assert 'page_key == "/control/utilities/notification-roles"' in contract
    assert 'payload.get("channel_id") is not None' in contract
    assert 'validated["channel_id"] = None' in page_save
    assert 'nested.payload.get("channel_id") is None' in page_save
    assert "await self.executor.resources.get(guild.id, ResourceKey.ROLE_PANEL)" in page_save
    assert "await self.resources.get(guild.id, ResourceKey.ROLE_PANEL)" in executor


def test_quiz_lifecycle_actions_stay_database_transactional() -> None:
    page_save = _text("src/marwie_bot/features/control_plane/page_save_executor.py")
    for token in ("UPDATE_QUIZ_QUESTION", "SET_QUIZ_QUESTION_ENABLED"):
        assert token in page_save.split("_DB_ONLY_ACTIONS", 1)[1].split(")", 1)[0]
    assert "async with self.executor.control.database.transaction()" in page_save


def test_commands_only_actions_are_not_owned_by_stage3_feature_pages() -> None:
    pages = {
        "community": _text("docs-site/control-community.js"),
        "content": _text("docs-site/control-content.js"),
        "utilities": _text("docs-site/control-utilities.js"),
    }
    assert "adjust_reputation" not in pages["community"]
    assert "poll_ai_sources" not in pages["content"]
    assert "Poll now" not in pages["content"]
    assert "refresh_ticket_panel" not in pages["utilities"]
    assert "Post ticket panel" not in pages["utilities"]


def test_content_executor_keeps_current_mapping_and_expected_id_safety() -> None:
    executor = _text("src/marwie_bot/features/control_plane/executor.py")
    for token in (
        "ResourceKey.ANNOUNCEMENTS",
        "ResourceKey.LIVE_ANNOUNCEMENTS",
        "ResourceKey.LIVE_PING_ROLE",
        "expected_channel_id",
        "role_resource = await self.resources.get(guild.id, ResourceKey.LIVE_PING_ROLE)",
        "role = guild.get_role(role_resource.discord_id) if role_resource is not None else None",
    ):
        assert token in executor
    assert "/ai-source poll" in executor


def test_analytics_revision_and_save_ownership_exclude_metric_totals() -> None:
    revisions = _text("src/marwie_bot/features/control_plane/page_revisions.py")
    contract = _text("src/marwie_bot/features/control_plane/page_save_contract.py")
    assert 'if page_key == "/control/analytics":' in revisions
    assert 'return {"feature": _feature_enabled(snapshot, "analytics")}' in revisions
    assert '"/control/analytics": frozenset({"set_feature"})' in contract


def test_workflows_remain_read_only_document_pages() -> None:
    workflows = _text("docs-site/control-workflows.js")
    for forbidden in (
        "control-eyebrow",
        "data-control-field",
        "enqueuePageSave",
        "onSave",
        "<button",
    ):
        assert forbidden not in workflows
    for route in ("moderation", "ticket-handling", "events"):
        assert f"/control/workflows/{route}" in workflows


def test_command_manual_copies_are_byte_identical_and_keep_wave7_wave9_contracts() -> None:
    docs = (ROOT / "docs/commands.md").read_bytes()
    site = (ROOT / "docs-site/commands.md").read_bytes()
    assert docs == site
    text = docs.decode()
    index = text.split("## Command index", 1)[1].split("\n## ", 1)[0]
    assert len(re.findall(r"(?m)^\d+\. `/", index)) == 43
    poll = text.split("## `/ai-source poll`", 1)[1].split("\n## ", 1)[0].lower()
    for phrase in ("preview", "post", "cancel", "60 seconds", "20", "scheduled"):
        assert phrase in poll
    analytics = text.split("## `/analytics`", 1)[1].split("\n## ", 1)[0]
    for phrase in (
        "Manage Server",
        "168-hour UTC",
        "[period_start, period_end)",
        "No answers in this period",
        "aggregate-only",
        "replies privately",
        "weekly analytics post",
    ):
        assert phrase in analytics


def test_message_logging_stays_outside_control_domains() -> None:
    combined = "\n".join(
        _text(path)
        for path in (
            "docs-site/control-utilities.js",
            "docs-site/control-mappings.js",
            "docs-site/control-router.js",
        )
    )
    assert "Message Logging" not in combined
    assert "message-logging" not in combined
    assert "bot_log" not in _text("docs-site/control-utilities.js")
    assert "bot_log" not in _text("docs-site/control-mappings.js")
