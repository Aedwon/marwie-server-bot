from __future__ import annotations

import secrets
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol

from marwie_bot.features.ai_updates.repository import AISourceRecord
from marwie_bot.features.ai_updates.service import FeedItem


class ManualFeedPreviewInvalid(ValueError):
    """The manual feed preview is missing, stale, or no longer safe to publish."""


class ManualPollingRepository(Protocol):
    async def list_sources(
        self, guild_id: int | None = None, *, enabled_only: bool = False
    ) -> list[AISourceRecord]: ...

    async def existing_dedupe_keys(
        self, guild_id: int, dedupe_keys: list[str] | tuple[str, ...]
    ) -> set[str]: ...


@dataclass(frozen=True, slots=True)
class ManualFeedCandidate:
    source_id: int
    source_name: str
    source_category: str
    title: str
    url: str
    published_at: datetime | None
    dedupe_key: str

    @classmethod
    def from_item(cls, source: AISourceRecord, item: FeedItem) -> ManualFeedCandidate:
        return cls(
            source_id=source.id,
            source_name=source.name,
            source_category=source.category,
            title=item.title,
            url=item.url,
            published_at=item.published_at,
            dedupe_key=item.dedupe_key,
        )

    def feed_item(self) -> FeedItem:
        return FeedItem(
            title=self.title,
            url=self.url,
            published_at=self.published_at,
            dedupe_key=self.dedupe_key,
        )


@dataclass(frozen=True, slots=True)
class ManualFeedPreview:
    token: str
    guild_id: int
    actor_id: int
    destination_id: int
    candidates: tuple[ManualFeedCandidate, ...]
    expires_at: datetime


@dataclass(frozen=True, slots=True)
class _StoredPreview:
    preview: ManualFeedPreview
    sources: tuple[tuple[int, str, str, str, bool], ...]


FetchItems = Callable[[AISourceRecord], Awaitable[list[FeedItem]]]
ResolveDestination = Callable[[int], Awaitable[int | None]]
GuildPredicate = Callable[[int], Awaitable[bool]]
ActorPredicate = Callable[[int, int], Awaitable[bool]]
PublishCandidates = Callable[[int, int, tuple[ManualFeedCandidate, ...]], Awaitable[int]]
Clock = Callable[[], datetime]


class ManualFeedPollingService:
    def __init__(
        self,
        *,
        repository: ManualPollingRepository,
        fetch_items: FetchItems,
        resolve_destination: ResolveDestination,
        is_feature_enabled: GuildPredicate,
        can_manage_guild: ActorPredicate,
        publish_candidates: PublishCandidates,
        clock: Clock | None = None,
        ttl_seconds: int = 60,
    ) -> None:
        if ttl_seconds < 1:
            raise ValueError("Manual feed preview TTL must be positive.")
        self.repository = repository
        self.fetch_items = fetch_items
        self.resolve_destination = resolve_destination
        self.is_feature_enabled = is_feature_enabled
        self.can_manage_guild = can_manage_guild
        self.publish_candidates = publish_candidates
        self.clock = clock or (lambda: datetime.now(UTC))
        self.ttl = timedelta(seconds=ttl_seconds)
        self._previews: dict[str, _StoredPreview] = {}

    @staticmethod
    def _source_signature(
        sources: list[AISourceRecord],
    ) -> tuple[tuple[int, str, str, str, bool], ...]:
        return tuple(
            (source.id, source.name, source.url, source.category, source.enabled)
            for source in sources
        )

    def _purge_expired(self, now: datetime) -> None:
        expired = [
            token
            for token, stored in self._previews.items()
            if stored.preview.expires_at <= now
        ]
        for token in expired:
            self._previews.pop(token, None)

    async def _authorized_context(self, guild_id: int, actor_id: int) -> int:
        if not await self.can_manage_guild(guild_id, actor_id):
            raise ManualFeedPreviewInvalid("Manage Server permission is required for manual polling.")
        if not await self.is_feature_enabled(guild_id):
            raise ManualFeedPreviewInvalid("AI updates are disabled for this server.")
        destination_id = await self.resolve_destination(guild_id)
        if destination_id is None:
            raise ManualFeedPreviewInvalid("The AI updates destination is not connected.")
        return destination_id

    async def _candidates(
        self, guild_id: int, sources: list[AISourceRecord]
    ) -> tuple[ManualFeedCandidate, ...]:
        fetched: list[ManualFeedCandidate] = []
        seen: set[str] = set()
        for source in sources:
            items = await self.fetch_items(source)
            for item in items[-10:]:
                if item.dedupe_key in seen:
                    continue
                seen.add(item.dedupe_key)
                fetched.append(ManualFeedCandidate.from_item(source, item))

        if not fetched:
            return ()
        existing = await self.repository.existing_dedupe_keys(
            guild_id, tuple(candidate.dedupe_key for candidate in fetched)
        )
        return tuple(candidate for candidate in fetched if candidate.dedupe_key not in existing)

    async def preview(self, *, guild_id: int, actor_id: int) -> ManualFeedPreview:
        now = self.clock()
        self._purge_expired(now)
        destination_id = await self._authorized_context(guild_id, actor_id)
        sources = await self.repository.list_sources(guild_id, enabled_only=True)
        candidates = await self._candidates(guild_id, sources)
        token = secrets.token_urlsafe(24)
        preview = ManualFeedPreview(
            token=token,
            guild_id=guild_id,
            actor_id=actor_id,
            destination_id=destination_id,
            candidates=candidates,
            expires_at=now + self.ttl,
        )
        self._previews[token] = _StoredPreview(
            preview=preview,
            sources=self._source_signature(sources),
        )
        return preview

    def _require_preview(
        self, token: str, *, guild_id: int, actor_id: int
    ) -> _StoredPreview:
        stored = self._previews.get(token)
        if stored is None:
            raise ManualFeedPreviewInvalid("That manual feed preview is no longer available.")
        if stored.preview.guild_id != guild_id or stored.preview.actor_id != actor_id:
            raise ManualFeedPreviewInvalid("That manual feed preview belongs to another request.")
        if stored.preview.expires_at <= self.clock():
            self._previews.pop(token, None)
            raise ManualFeedPreviewInvalid("That manual feed preview expired. Fetch a new preview.")
        return stored

    async def cancel(self, token: str, *, guild_id: int, actor_id: int) -> None:
        self._require_preview(token, guild_id=guild_id, actor_id=actor_id)
        self._previews.pop(token, None)

    async def post(self, token: str, *, guild_id: int, actor_id: int) -> int:
        stored = self._require_preview(token, guild_id=guild_id, actor_id=actor_id)
        try:
            destination_id = await self._authorized_context(guild_id, actor_id)
        except ManualFeedPreviewInvalid:
            self._previews.pop(token, None)
            raise
        if destination_id != stored.preview.destination_id:
            self._previews.pop(token, None)
            raise ManualFeedPreviewInvalid(
                "The AI updates destination changed after preview. Fetch a new preview."
            )

        sources = await self.repository.list_sources(guild_id, enabled_only=True)
        if self._source_signature(sources) != stored.sources:
            self._previews.pop(token, None)
            raise ManualFeedPreviewInvalid(
                "An AI source changed after preview. Fetch a new preview."
            )

        candidates = await self._candidates(guild_id, sources)
        if candidates != stored.preview.candidates:
            self._previews.pop(token, None)
            raise ManualFeedPreviewInvalid(
                "The feed candidate set changed after preview. Fetch a new preview."
            )

        self._previews.pop(token, None)
        return await self.publish_candidates(guild_id, destination_id, stored.preview.candidates)
