from pathlib import Path

from marwie_bot.features.control_plane.domain import ControlActionType

ROOT = Path(__file__).resolve().parents[1]
EXECUTOR = (ROOT / "src/marwie_bot/features/control_plane/page_save_executor.py").read_text()
COG = (ROOT / "src/marwie_bot/features/control_plane/cog.py").read_text()


def test_save_page_is_a_durable_worker_action_and_publishes_page_revisions() -> None:
    assert ControlActionType.SAVE_PAGE.value == "save_page"
    assert "ControlActionType.SAVE_PAGE" in COG
    assert "build_page_revisions(snapshot)" in COG
    assert "PageSaveExecutor" in COG


def test_revision_conflict_and_preflight_happen_before_mutation_loop() -> None:
    conflict = EXECUTOR.index('if current_revision != payload["base_revision"]')
    preflight = EXECUTOR.index("await self._preflight(guild, actor, changes)")
    mutation_loop = EXECUTOR.index("for index, change in enumerate(changes):")
    assert conflict < preflight < mutation_loop
    assert '"outcome": "conflict"' in EXECUTOR


def test_partial_results_are_itemized_and_unexpected_item_errors_are_sanitized() -> None:
    assert '"status": "applied"' in EXECUTOR
    assert '"status": "failed"' in EXECUTOR
    assert '"status": "not_attempted"' in EXECUTOR
    assert '"That change failed unexpectedly."' in EXECUTOR
    assert "error_reference" in EXECUTOR


def test_notification_panel_external_preflight_checks_send_and_embed_permissions() -> None:
    assert "permissions_for(bot_member)" in EXECUTOR
    assert "permissions.send_messages" in EXECUTOR
    assert "permissions.embed_links" in EXECUTOR
