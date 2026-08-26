from __future__ import annotations

import asyncio
import logging
import secrets
from importlib.metadata import PackageNotFoundError, version
from typing import Any, Protocol, cast

import discord
from discord.ext import commands

from marwie_bot.config.settings import Settings
from marwie_bot.db.session import Database
from marwie_bot.features.ai_updates.repository import SQLAlchemyAIUpdatesRepository
from marwie_bot.features.configuration.provisioning import AutoSetupService
from marwie_bot.features.configuration.repository import (
    SQLAlchemyFeatureConfigRepository,
    SQLAlchemyResourceRepository,
)
from marwie_bot.features.configuration.service import FeatureConfigService, ResourceService
from marwie_bot.features.control_plane.domain import ControlActionRecord, ControlActionType
from marwie_bot.features.control_plane.executor import ActionRejected, ControlActionExecutor
from marwie_bot.features.control_plane.notification_panel import NotificationRoleView
from marwie_bot.features.control_plane.repository import SQLAlchemyControlRepository
from marwie_bot.features.control_plane.snapshot import GuildSnapshotBuilder
from marwie_bot.features.control_plane.validation import validate_action_payload
from marwie_bot.features.quizzes.repository import SQLAlchemyQuizRepository
from marwie_bot.features.quizzes.service import QuizService
from marwie_bot.features.reputation.repository import SQLAlchemyReputationRepository
from marwie_bot.features.reputation.service import ReputationService
from marwie_bot.features.tickets.repository import SQLAlchemyTicketRepository
from marwie_bot.features.tickets.service import TicketService

logger = logging.getLogger(__name__)

_QUIZ_SCHEDULER_ACTIONS = {
    ControlActionType.SET_RESOURCE,
    ControlActionType.CLEAR_RESOURCE,
    ControlActionType.APPLY_AUTO_SETUP,
    ControlActionType.SET_FEATURE,
    ControlActionType.SET_QUIZ_SCHEDULE,
    ControlActionType.ADD_QUIZ_QUESTION,
}


class QuizScheduler(Protocol):
    def notify_scheduler(self, guild_id: int | None = None) -> None: ...


def _worker_version() -> str:
    try:
        return version("marwie-server-bot")
    except PackageNotFoundError:
        return "development"


class ControlPlaneCog(commands.Cog):
    def __init__(
        self,
        *,
        bot: commands.Bot,
        settings: Settings,
        repository: SQLAlchemyControlRepository,
        executor: ControlActionExecutor,
        snapshots: GuildSnapshotBuilder,
    ) -> None:
        self.bot = bot
        self.settings = settings
        self.repository = repository
        self.executor = executor
        self.snapshots = snapshots
        self.worker_id = f"rob-bot:{_worker_version()}"
        self._drain_lock = asyncio.Lock()
        self._startup_lock = asyncio.Lock()
        self._ready_initialized = False

    async def _refresh_snapshot(self, guild_id: int) -> None:
        guild = self.bot.get_guild(guild_id)
        if guild is None:
            return
        snapshot = await self.snapshots.build(guild)
        await self.repository.upsert_snapshot(guild.id, snapshot, self.worker_id)

    async def _register_notification_views(self) -> None:
        for guild in self.bot.guilds:
            panel = await self.repository.get_notification_panel(guild.id)
            if panel is None or not panel.buttons:
                continue
            view = NotificationRoleView(panel)
            if panel.message_id is None:
                self.bot.add_view(view)
            else:
                self.bot.add_view(view, message_id=panel.message_id)

    def _notify_runtime_schedulers(self, action: ControlActionRecord) -> None:
        if action.action_type not in _QUIZ_SCHEDULER_ACTIONS:
            return
        cog = self.bot.get_cog("QuizzesCog")
        if cog is not None and hasattr(cog, "notify_scheduler"):
            cast(QuizScheduler, cog).notify_scheduler(action.guild_id)

    async def _execute_snapshot_refresh(self, action: ControlActionRecord) -> dict[str, Any]:
        guild = self.bot.get_guild(action.guild_id)
        if guild is None:
            raise ActionRejected("Rob-bot is no longer connected to that server.")
        member = guild.get_member(action.actor_id)
        if member is None:
            try:
                member = await guild.fetch_member(action.actor_id)
            except (discord.NotFound, discord.Forbidden, discord.HTTPException) as error:
                raise ActionRejected(
                    "Your Discord membership could not be verified. Sign in again and retry."
                ) from error
        permissions = member.guild_permissions
        if not permissions.administrator and not permissions.manage_guild:
            raise ActionRejected("Manage Server permission is required to refresh control state.")
        validate_action_payload(action.action_type, action.payload)
        return {"refresh_requested": True}

    async def _execute_action(self, action: ControlActionRecord) -> dict[str, Any]:
        if action.action_type is ControlActionType.REFRESH_SNAPSHOT:
            return await self._execute_snapshot_refresh(action)
        return await self.executor.execute(action)

    async def _process_action(self, action: ControlActionRecord) -> None:
        refresh_after_action = True
        try:
            result = await self._execute_action(action)
        except ActionRejected as error:
            await self.repository.reject(action.id, str(error))
            if action.action_type is ControlActionType.REFRESH_SNAPSHOT:
                refresh_after_action = False
        except ValueError as error:
            await self.repository.reject(action.id, str(error))
            if action.action_type is ControlActionType.REFRESH_SNAPSHOT:
                refresh_after_action = False
        except Exception:
            reference = secrets.token_hex(4).upper()
            logger.exception(
                "Control action failed action_id=%s guild_id=%s actor_id=%s error_reference=%s",
                action.id,
                action.guild_id,
                action.actor_id,
                reference,
            )
            await self.repository.fail(
                action.id,
                "The action failed unexpectedly.",
                reference,
            )
            if action.action_type is ControlActionType.REFRESH_SNAPSHOT:
                refresh_after_action = False
        else:
            await self.repository.complete(action.id, result)
            self._notify_runtime_schedulers(action)

        if not refresh_after_action:
            return
        try:
            await self._refresh_snapshot(action.guild_id)
        except Exception:
            logger.exception(
                "Could not refresh control snapshot after action action_id=%s guild_id=%s",
                action.id,
                action.guild_id,
            )

    async def _drain_actions(self) -> int:
        if not self.settings.enable_background_tasks:
            return 0
        processed = 0
        async with self._drain_lock:
            while True:
                action = await self.repository.claim_next(self.worker_id)
                if action is None:
                    return processed
                await self._process_action(action)
                processed += 1

    async def _initialize_ready(self) -> None:
        if not self.settings.enable_background_tasks:
            return
        async with self._startup_lock:
            if self._ready_initialized:
                return
            await self._register_notification_views()
            await self._drain_actions()
            for guild in self.bot.guilds:
                try:
                    await self._refresh_snapshot(guild.id)
                except Exception:
                    logger.exception(
                        "Could not publish initial control snapshot guild_id=%s", guild.id
                    )
            self._ready_initialized = True
            if self.settings.control_wake_webhook_id is None:
                logger.warning(
                    "CONTROL_WAKE_WEBHOOK_ID is not configured; browser actions will only drain at bot startup"
                )

    @commands.Cog.listener()
    async def on_ready(self) -> None:
        await self._initialize_ready()

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message) -> None:
        webhook_id = self.settings.control_wake_webhook_id
        if (
            not self.settings.enable_background_tasks
            or webhook_id is None
            or message.webhook_id != webhook_id
        ):
            return
        logger.info("Control wake received webhook_id=%s", webhook_id)
        processed = await self._drain_actions()
        logger.info("Control wake drain complete processed=%s", processed)


async def setup(bot: commands.Bot) -> None:
    database = getattr(bot, "database", None)
    settings = getattr(bot, "settings", None)
    if not isinstance(database, Database):
        raise RuntimeError("Database is not initialized before loading ControlPlaneCog")
    if not isinstance(settings, Settings):
        raise RuntimeError("Settings are not initialized before loading ControlPlaneCog")

    resource_repository = SQLAlchemyResourceRepository(database)
    feature_repository = SQLAlchemyFeatureConfigRepository(database)
    resources = ResourceService(resource_repository)
    features = FeatureConfigService(feature_repository)
    provisioner = AutoSetupService(resources)
    tickets = TicketService(SQLAlchemyTicketRepository(database))
    reputation = ReputationService(SQLAlchemyReputationRepository(database))
    quizzes = QuizService(SQLAlchemyQuizRepository(database))
    ai_sources = SQLAlchemyAIUpdatesRepository(database)
    control = SQLAlchemyControlRepository(database)

    executor = ControlActionExecutor(
        bot=bot,
        settings=settings,
        resources=resources,
        features=features,
        provisioner=provisioner,
        tickets=tickets,
        reputation=reputation,
        quizzes=quizzes,
        ai_sources=ai_sources,
        control=control,
    )
    snapshots = GuildSnapshotBuilder(
        resources=resources,
        features=features,
        tickets=tickets,
        ai_sources=ai_sources,
        control=control,
        provisioner=provisioner,
        settings=settings,
    )
    await bot.add_cog(
        ControlPlaneCog(
            bot=bot,
            settings=settings,
            repository=control,
            executor=executor,
            snapshots=snapshots,
        )
    )
