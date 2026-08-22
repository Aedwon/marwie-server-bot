from __future__ import annotations

from sqlalchemy import select

from marwie_bot.db.models import Guild, ModerationCase
from marwie_bot.db.session import Database
from marwie_bot.features.moderation.service import ModerationCaseRecord


class SQLAlchemyModerationRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    @staticmethod
    def _record(model: ModerationCase) -> ModerationCaseRecord:
        return ModerationCaseRecord(
            id=model.id,
            guild_id=model.guild_id,
            action=model.action,
            target_id=model.target_id,
            moderator_id=model.moderator_id,
            reason=model.reason,
            created_at=model.created_at,
            expires_at=model.expires_at,
        )

    async def create_warning(
        self,
        guild_id: int,
        target_id: int,
        moderator_id: int,
        reason: str,
    ) -> ModerationCaseRecord:
        async with self.database.session() as session:
            guild = await session.get(Guild, guild_id)
            if guild is None:
                session.add(Guild(guild_id=guild_id))

            model = ModerationCase(
                guild_id=guild_id,
                action="warn",
                target_id=target_id,
                moderator_id=moderator_id,
                reason=reason,
            )
            session.add(model)
            await session.commit()
            await session.refresh(model)
            return self._record(model)

    async def list_history(
        self,
        guild_id: int,
        target_id: int,
        limit: int,
    ) -> list[ModerationCaseRecord]:
        async with self.database.session() as session:
            statement = (
                select(ModerationCase)
                .where(
                    ModerationCase.guild_id == guild_id,
                    ModerationCase.target_id == target_id,
                )
                .order_by(ModerationCase.created_at.desc(), ModerationCase.id.desc())
                .limit(limit)
            )
            models = (await session.execute(statement)).scalars().all()
            return [self._record(model) for model in models]
