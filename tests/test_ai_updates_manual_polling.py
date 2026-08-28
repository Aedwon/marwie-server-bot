from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from marwie_bot.features.ai_updates.manual_polling import (
    ManualFeedPollingService,
    ManualFeedPreviewInvalid,
)
from marwie_bot.features.ai_updates.repository import AISourceRecord
from marwie_bot.features.ai_updates.service import FeedItem


GUILD_ID = 100
ACTOR_ID = 200
DESTINATION_ID = 300


def source(
    *,
    source_id: int = 1,
    name: str = "OpenAI",
    url: str = "https://example.com/feed.xml",
    category: str = "AI",
    enabled: bool = True,
) -> AISourceRecord:
    return AISourceRecord(
        id=source_id,
        guild_id=GUILD_ID,
        name=name,
        url=url,
        category=category,
        enabled=enabled,
        last_checked_at=None,
    )


def item(
    *,
    title: str = "Release",
    url: str = "https://example.com/release",
    dedupe_key: str = "candidate-1",
) -> FeedItem:
    return FeedItem(
        title=title,
        url=url,
        published_at=datetime(2026, 8, 28, 12, 0, tzinfo=UTC),
        dedupe_key=dedupe_key,
    )


class FakeRepository:
    def __init__(self) -> None:
        self.sources = [source()]
        self.posted: set[str] = set()
        self.mutations: list[str] = []

    async def list_sources(
        self,
        guild_id: int | None = None,
        *,
        enabled_only: bool = False,
    ) -> list[AISourceRecord]:
        rows = list(self.sources)
        if guild_id is not None:
            rows = [row for row in rows if row.guild_id == guild_id]
        if enabled_only:
            rows = [row for row in rows if row.enabled]
        return rows

    async def existing_dedupe_keys(
        self,
        guild_id: int,
        dedupe_keys: list[str] | tuple[str, ...],
    ) -> set[str]:
        assert guild_id == GUILD_ID
        return self.posted.intersection(dedupe_keys)


class Harness:
    def __init__(self) -> None:
        self.repository = FakeRepository()
        self.now = datetime(2026, 8, 28, 12, 0, tzinfo=UTC)
        self.destination_id = DESTINATION_ID
        self.authorized = True
        self.feature_enabled = True
        self.feed_items: dict[int, list[FeedItem]] = {1: [item()]}
        self.published: list[tuple[int, int, tuple[Any, ...]]] = []

        async def fetch_items(record: AISourceRecord) -> list[FeedItem]:
            return list(self.feed_items.get(record.id, []))

        async def resolve_destination(guild_id: int) -> int | None:
            assert guild_id == GUILD_ID
            return self.destination_id

        async def is_feature_enabled(guild_id: int) -> bool:
            assert guild_id == GUILD_ID
            return self.feature_enabled

        async def can_manage_guild(guild_id: int, actor_id: int) -> bool:
            assert guild_id == GUILD_ID
            assert actor_id == ACTOR_ID
            return self.authorized

        async def publish_candidates(
            guild_id: int,
            destination_id: int,
            candidates: tuple[Any, ...],
        ) -> int:
            self.published.append((guild_id, destination_id, candidates))
            self.repository.posted.update(candidate.dedupe_key for candidate in candidates)
            self.repository.mutations.append("publish")
            return len(candidates)

        self.service = ManualFeedPollingService(
            repository=self.repository,
            fetch_items=fetch_items,
            resolve_destination=resolve_destination,
            is_feature_enabled=is_feature_enabled,
            can_manage_guild=can_manage_guild,
            publish_candidates=publish_candidates,
            clock=lambda: self.now,
            ttl_seconds=60,
        )


@pytest.mark.asyncio
async def test_preview_fetch_is_non_mutating_and_never_publishes() -> None:
    harness = Harness()

    preview = await harness.service.preview(guild_id=GUILD_ID, actor_id=ACTOR_ID)

    assert [candidate.dedupe_key for candidate in preview.candidates] == ["candidate-1"]
    assert preview.destination_id == DESTINATION_ID
    assert harness.published == []
    assert harness.repository.mutations == []
    assert harness.repository.posted == set()


@pytest.mark.asyncio
async def test_cancel_removes_preview_without_publish_mutation() -> None:
    harness = Harness()
    preview = await harness.service.preview(guild_id=GUILD_ID, actor_id=ACTOR_ID)

    await harness.service.cancel(preview.token, guild_id=GUILD_ID, actor_id=ACTOR_ID)

    assert harness.published == []
    assert harness.repository.mutations == []
    with pytest.raises(ManualFeedPreviewInvalid):
        await harness.service.post(preview.token, guild_id=GUILD_ID, actor_id=ACTOR_ID)


@pytest.mark.asyncio
async def test_post_publishes_exact_previewed_valid_candidates() -> None:
    harness = Harness()
    preview = await harness.service.preview(guild_id=GUILD_ID, actor_id=ACTOR_ID)

    result = await harness.service.post(
        preview.token,
        guild_id=GUILD_ID,
        actor_id=ACTOR_ID,
    )

    assert result == 1
    assert len(harness.published) == 1
    guild_id, destination_id, candidates = harness.published[0]
    assert guild_id == GUILD_ID
    assert destination_id == DESTINATION_ID
    assert candidates == preview.candidates


@pytest.mark.asyncio
async def test_expired_preview_fails_closed() -> None:
    harness = Harness()
    preview = await harness.service.preview(guild_id=GUILD_ID, actor_id=ACTOR_ID)
    harness.now += timedelta(seconds=61)

    with pytest.raises(ManualFeedPreviewInvalid, match="expired"):
        await harness.service.post(preview.token, guild_id=GUILD_ID, actor_id=ACTOR_ID)

    assert harness.published == []


@pytest.mark.asyncio
async def test_source_change_invalidates_preview() -> None:
    harness = Harness()
    preview = await harness.service.preview(guild_id=GUILD_ID, actor_id=ACTOR_ID)
    harness.repository.sources = [source(name="Renamed source")]

    with pytest.raises(ManualFeedPreviewInvalid, match="source"):
        await harness.service.post(preview.token, guild_id=GUILD_ID, actor_id=ACTOR_ID)

    assert harness.published == []


@pytest.mark.asyncio
async def test_destination_mapping_change_invalidates_preview() -> None:
    harness = Harness()
    preview = await harness.service.preview(guild_id=GUILD_ID, actor_id=ACTOR_ID)
    harness.destination_id = 999

    with pytest.raises(ManualFeedPreviewInvalid, match="destination"):
        await harness.service.post(preview.token, guild_id=GUILD_ID, actor_id=ACTOR_ID)

    assert harness.published == []


@pytest.mark.asyncio
async def test_permission_is_rechecked_at_post_time() -> None:
    harness = Harness()
    preview = await harness.service.preview(guild_id=GUILD_ID, actor_id=ACTOR_ID)
    harness.authorized = False

    with pytest.raises(ManualFeedPreviewInvalid, match="permission"):
        await harness.service.post(preview.token, guild_id=GUILD_ID, actor_id=ACTOR_ID)

    assert harness.published == []


@pytest.mark.asyncio
async def test_candidate_change_cannot_publish_a_different_item_set() -> None:
    harness = Harness()
    preview = await harness.service.preview(guild_id=GUILD_ID, actor_id=ACTOR_ID)
    harness.feed_items[1] = [
        item(title="Different", url="https://example.com/different", dedupe_key="candidate-2")
    ]

    with pytest.raises(ManualFeedPreviewInvalid, match="candidate"):
        await harness.service.post(preview.token, guild_id=GUILD_ID, actor_id=ACTOR_ID)

    assert harness.published == []


@pytest.mark.asyncio
async def test_dedupe_change_cannot_shrink_preview_and_publish_remainder() -> None:
    harness = Harness()
    preview = await harness.service.preview(guild_id=GUILD_ID, actor_id=ACTOR_ID)
    harness.repository.posted.add("candidate-1")

    with pytest.raises(ManualFeedPreviewInvalid, match="candidate"):
        await harness.service.post(preview.token, guild_id=GUILD_ID, actor_id=ACTOR_ID)

    assert harness.published == []


@pytest.mark.asyncio
async def test_preview_token_is_bound_to_actor_and_guild() -> None:
    harness = Harness()
    preview = await harness.service.preview(guild_id=GUILD_ID, actor_id=ACTOR_ID)

    with pytest.raises(ManualFeedPreviewInvalid):
        await harness.service.post(preview.token, guild_id=GUILD_ID, actor_id=ACTOR_ID + 1)
    with pytest.raises(ManualFeedPreviewInvalid):
        await harness.service.post(preview.token, guild_id=GUILD_ID + 1, actor_id=ACTOR_ID)

    assert harness.published == []
