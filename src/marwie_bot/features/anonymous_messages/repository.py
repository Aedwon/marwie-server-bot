from __future__ import annotations

from datetime import datetime
from typing import Any, cast

from sqlalchemy import delete, func, select
from sqlalchemy.engine import CursorResult

from marwie_bot.db.models import AnonymousMessage, AnonymousMessagePanel
from marwie_bot.db.session import Database
from marwie_bot.features.anonymous_messages.service import (
    AnonymousMessageKind,
    AnonymousMessageRecord,
    AnonymousPanelRecord,
)


class SQLAlchemyAnonymousMessageRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    @staticmethod
    def _message_record(model: AnonymousMessage) -> AnonymousMessageRecord:
        return AnonymousMessageRecord(
            id=model.id,
            guild_id=model.guild_id,
            user_id=model.user_id,
            channel_id=model.channel_id,
            message_id=model.message_id,
            kind=AnonymousMessageKind(model.kind),
            display_number=model.display_number,
            reply_to_message_id=model.reply_to_message_id,
            content=model.content,
            deleted_at=model.deleted_at,
            created_at=model.created_at,
        )

    @staticmethod
    def _panel_record(model: AnonymousMessagePanel) -> AnonymousPanelRecord:
        return AnonymousPanelRecord(
            guild_id=model.guild_id,
            channel_id=model.channel_id,
            message_id=model.message_id,
            updated_at=model.updated_at,
        )

    async def next_display_number(self, guild_id: int) -> int:
        async with self.database.session() as session:
            statement = select(func.max(AnonymousMessage.display_number)).where(
                AnonymousMessage.guild_id == guild_id,
                AnonymousMessage.kind == AnonymousMessageKind.MESSAGE.value,
                AnonymousMessage.deleted_at.is_(None),
            )
            current = (await session.execute(statement)).scalar_one_or_none()
            return int(current or 0) + 1

    async def create(
        self,
        *,
        guild_id: int,
        user_id: int,
        channel_id: int,
        kind: AnonymousMessageKind,
        content: str,
        display_number: int | None,
        reply_to_message_id: int | None,
    ) -> AnonymousMessageRecord:
        async with self.database.session() as session:
            model = AnonymousMessage(
                guild_id=guild_id,
                user_id=user_id,
                channel_id=channel_id,
                kind=kind.value,
                content=content,
                display_number=display_number,
                reply_to_message_id=reply_to_message_id,
            )
            session.add(model)
            await session.commit()
            await session.refresh(model)
            return self._message_record(model)

    async def attach_message(self, record_id: int, message_id: int) -> AnonymousMessageRecord:
        async with self.database.session() as session:
            model = await session.get(AnonymousMessage, record_id)
            if model is None:
                raise RuntimeError(
                    "Anonymous message disappeared before Discord message attachment"
                )
            model.message_id = message_id
            await session.commit()
            await session.refresh(model)
            return self._message_record(model)

    async def discard_unposted(self, record_id: int) -> bool:
        async with self.database.session() as session:
            model = await session.get(AnonymousMessage, record_id)
            if model is None or model.message_id is not None:
                return False
            await session.delete(model)
            await session.commit()
            return True

    async def mark_deleted_by_message(
        self, guild_id: int, message_id: int, deleted_at: datetime
    ) -> bool:
        async with self.database.session() as session:
            statement = select(AnonymousMessage).where(
                AnonymousMessage.guild_id == guild_id,
                AnonymousMessage.message_id == message_id,
            )
            model = (await session.execute(statement)).scalar_one_or_none()
            if model is None or model.deleted_at is not None:
                return False
            model.deleted_at = deleted_at
            await session.commit()
            return True

    async def list_active_top_level(self, guild_id: int) -> list[AnonymousMessageRecord]:
        async with self.database.session() as session:
            statement = (
                select(AnonymousMessage)
                .where(
                    AnonymousMessage.guild_id == guild_id,
                    AnonymousMessage.kind == AnonymousMessageKind.MESSAGE.value,
                    AnonymousMessage.deleted_at.is_(None),
                    AnonymousMessage.message_id.is_not(None),
                )
                .order_by(AnonymousMessage.created_at.asc(), AnonymousMessage.id.asc())
            )
            models = (await session.execute(statement)).scalars().all()
            return [self._message_record(model) for model in models]

    async def set_display_number(
        self, record_id: int, display_number: int
    ) -> AnonymousMessageRecord:
        async with self.database.session() as session:
            model = await session.get(AnonymousMessage, record_id)
            if model is None:
                raise RuntimeError("Anonymous message disappeared during renumbering")
            model.display_number = display_number
            await session.commit()
            await session.refresh(model)
            return self._message_record(model)

    async def get_panel(self, guild_id: int) -> AnonymousPanelRecord | None:
        async with self.database.session() as session:
            model = await session.get(AnonymousMessagePanel, guild_id)
            return self._panel_record(model) if model is not None else None

    async def save_panel(
        self, guild_id: int, channel_id: int, message_id: int
    ) -> AnonymousPanelRecord:
        async with self.database.session() as session:
            model = await session.get(AnonymousMessagePanel, guild_id)
            if model is None:
                model = AnonymousMessagePanel(
                    guild_id=guild_id,
                    channel_id=channel_id,
                    message_id=message_id,
                )
                session.add(model)
            else:
                model.channel_id = channel_id
                model.message_id = message_id
            await session.commit()
            await session.refresh(model)
            return self._panel_record(model)

    async def clear_panel(self, guild_id: int) -> bool:
        async with self.database.session() as session:
            result = await session.execute(
                delete(AnonymousMessagePanel).where(AnonymousMessagePanel.guild_id == guild_id)
            )
            await session.commit()
            return bool(cast(CursorResult[Any], result).rowcount)
