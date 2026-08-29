from pathlib import Path

from marwie_bot.config.resources import FeatureName, ResourceKey, ResourceType
from marwie_bot.db.base import Base
from marwie_bot.db.models import FeatureFlag, Guild, GuildResource
from marwie_bot.db.session import Database
from marwie_bot.features.configuration.repository import (
    SQLAlchemyFeatureConfigRepository,
    SQLAlchemyResourceRepository,
)
from marwie_bot.features.configuration.service import FeatureConfigService, ResourceService

ROOT = Path(__file__).resolve().parents[1]


async def _database_with_retired_rows() -> Database:
    database = Database("sqlite+aiosqlite:///:memory:")
    async with database.engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with database.session() as session:
        session.add(Guild(guild_id=100))
        session.add_all(
            [
                GuildResource(
                    guild_id=100,
                    key=ResourceKey.MODERATION_LOG.value,
                    resource_type=ResourceType.CHANNEL.value,
                    discord_id=200,
                    updated_by=300,
                ),
                GuildResource(
                    guild_id=100,
                    key="build_help_forum",
                    resource_type=ResourceType.CHANNEL.value,
                    discord_id=201,
                    updated_by=300,
                ),
                GuildResource(
                    guild_id=100,
                    key="solved_tag",
                    resource_type=ResourceType.FORUM_TAG.value,
                    discord_id=202,
                    updated_by=300,
                ),
                FeatureFlag(
                    guild_id=100,
                    feature=FeatureName.ANALYTICS.value,
                    enabled=False,
                    config_json={"last_reported_at": "2026-08-01T00:00:00+00:00"},
                ),
                FeatureFlag(
                    guild_id=100,
                    feature="build_help",
                    enabled=True,
                    config_json={"legacy": True},
                ),
            ]
        )
        await session.commit()
    return database


async def test_resource_bulk_read_ignores_rows_outside_current_resource_enum() -> None:
    database = await _database_with_retired_rows()
    try:
        service = ResourceService(SQLAlchemyResourceRepository(database))
        records = await service.list_for_guild(100)

        assert [(record.key, record.discord_id) for record in records] == [
            (ResourceKey.MODERATION_LOG, 200)
        ]
    finally:
        await database.close()


async def test_feature_bulk_read_ignores_rows_outside_current_feature_enum() -> None:
    database = await _database_with_retired_rows()
    try:
        service = FeatureConfigService(SQLAlchemyFeatureConfigRepository(database))
        records = await service.list_for_guild(100)

        assert {record.feature for record in records} == set(FeatureName)
        analytics = next(record for record in records if record.feature is FeatureName.ANALYTICS)
        assert analytics.enabled is False
        assert analytics.config == {"last_reported_at": "2026-08-01T00:00:00+00:00"}
    finally:
        await database.close()


def test_retired_build_help_tagging_copy_is_absent_from_live_manuals_and_confirmation() -> None:
    manual = (ROOT / "docs/commands.md").read_text()
    site_manual = (ROOT / "docs-site/commands.md").read_text()
    confirmation = (ROOT / "src/marwie_bot/features/configuration/cog.py").read_text()
    live_docs = [
        (ROOT / "docs-site/index.html").read_text(),
        (ROOT / "docs-site/commands.html").read_text(),
        (ROOT / "docs-site/commands.js").read_text(),
        (ROOT / "docs-site/app.js").read_text(),
    ]

    assert manual == site_manual
    for text in (manual, confirmation, *live_docs):
        lowered = text.casefold()
        assert "build help" not in lowered
        assert "build-help" not in lowered
        assert "/solve" not in lowered
        assert "solved tag" not in lowered
        assert "`solved` tag" not in lowered
        assert "tagged" not in lowered
