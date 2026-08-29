from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select

from marwie_bot.db.models import AIUpdateItem, AIUpdateSource
from marwie_bot.db.session import Database
from marwie_bot.features.ai_updates.service import FeedItem


@dataclass(frozen=True, slots=True)
class AISourceRecord:
    id: int
    guild_id: int
    name: str
    url: str
    category: str
    enabled: bool
    last_checked_at: datetime | None


@dataclass(frozen=True, slots=True)
class AIItemRecord:
    id: int
    guild_id: int
    source_id: int
    title: str
    url: str
    published_at: datetime | None


class SQLAlchemyAIUpdatesRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    @staticmethod
    def _source(model: AIUpdateSource) -> AISourceRecord:
        return AISourceRecord(
            model.id,
            model.guild_id,
            model.name,
            model.url,
            model.category,
            model.enabled,
            model.last_checked_at,
        )

    async def add_source(self, guild_id: int, name: str, url: str, category: str) -> AISourceRecord:
        async with self.database.session() as session:
            existing = (
                await session.execute(
                    select(AIUpdateSource).where(
                        AIUpdateSource.guild_id == guild_id,
                        AIUpdateSource.url == url,
                    )
                )
            ).scalar_one_or_none()
            if existing is not None:
                existing.name = name
                existing.category = category
                existing.enabled = True
                await session.commit()
                await session.refresh(existing)
                return self._source(existing)
            model = AIUpdateSource(
                guild_id=guild_id,
                name=name,
                url=url,
                category=category,
                enabled=True,
            )
            session.add(model)
            await session.commit()
            await session.refresh(model)
            return self._source(model)

    async def update_source(
        self,
        guild_id: int,
        source_id: int,
        name: str,
        url: str,
        category: str,
    ) -> AISourceRecord | None:
        async with self.database.session() as session:
            model = await session.get(AIUpdateSource, source_id)
            if model is None or model.guild_id != guild_id:
                return None
            duplicate = (
                await session.execute(
                    select(AIUpdateSource.id).where(
                        AIUpdateSource.guild_id == guild_id,
                        AIUpdateSource.url == url,
                        AIUpdateSource.id != source_id,
                    )
                )
            ).scalar_one_or_none()
            if duplicate is not None:
                raise ValueError("Another AI source already uses that URL.")
            model.name = name
            model.url = url
            model.category = category
            model.enabled = True
            await session.commit()
            await session.refresh(model)
            return self._source(model)

    async def list_sources(
        self, guild_id: int | None = None, *, enabled_only: bool = False
    ) -> list[AISourceRecord]:
        async with self.database.session() as session:
            statement = select(AIUpdateSource)
            if guild_id is not None:
                statement = statement.where(AIUpdateSource.guild_id == guild_id)
            if enabled_only:
                statement = statement.where(AIUpdateSource.enabled.is_(True))
            statement = statement.order_by(AIUpdateSource.guild_id, AIUpdateSource.name)
            models = (await session.execute(statement)).scalars().all()
            return [self._source(model) for model in models]

    async def existing_dedupe_keys(
        self,
        guild_id: int,
        dedupe_keys: list[str] | tuple[str, ...],
    ) -> set[str]:
        if not dedupe_keys:
            return set()
        async with self.database.session() as session:
            rows = (
                await session.execute(
                    select(AIUpdateItem.dedupe_key).where(
                        AIUpdateItem.guild_id == guild_id,
                        AIUpdateItem.dedupe_key.in_(dedupe_keys),
                    )
                )
            ).scalars()
            return set(rows)

    async def disable_source(self, guild_id: int, source_id: int) -> bool:
        async with self.database.session() as session:
            model = await session.get(AIUpdateSource, source_id)
            if model is None or model.guild_id != guild_id:
                return False
            model.enabled = False
            await session.commit()
            return True

    async def mark_checked(self, source_id: int) -> None:
        async with self.database.session() as session:
            model = await session.get(AIUpdateSource, source_id)
            if model is not None:
                model.last_checked_at = datetime.now(UTC)
                await session.commit()

    async def store_item(self, source: AISourceRecord, item: FeedItem) -> AIItemRecord | None:
        async with self.database.session() as session:
            existing = (
                await session.execute(
                    select(AIUpdateItem.id).where(
                        AIUpdateItem.guild_id == source.guild_id,
                        AIUpdateItem.dedupe_key == item.dedupe_key,
                    )
                )
            ).scalar_one_or_none()
            if existing is not None:
                return None
            model = AIUpdateItem(
                guild_id=source.guild_id,
                source_id=source.id,
                dedupe_key=item.dedupe_key,
                title=item.title,
                url=item.url,
                published_at=item.published_at,
            )
            session.add(model)
            await session.commit()
            await session.refresh(model)
            return AIItemRecord(
                model.id,
                model.guild_id,
                model.source_id,
                model.title,
                model.url,
                model.published_at,
            )

    async def mark_posted(self, item_id: int, message_id: int) -> None:
        async with self.database.session() as session:
            model = await session.get(AIUpdateItem, item_id)
            if model is not None:
                model.posted_message_id = message_id
                await session.commit()
