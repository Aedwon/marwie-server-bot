from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any, cast

import pytest

from marwie_bot.features.ai_updates.cog import ManualFeedPollView, _preview_embed
from marwie_bot.features.ai_updates.manual_polling import (
    ManualFeedCandidate,
    ManualFeedPollingService,
    ManualFeedPreview,
)
from marwie_bot.features.ai_updates.repository import AISourceRecord
from marwie_bot.features.ai_updates.service import FeedItem

GUILD_ID = 100
ACTOR_ID = 200
DESTINATION_ID = 300


def source(source_id: int) -> AISourceRecord:
    return AISourceRecord(
        id=source_id,
        guild_id=GUILD_ID,
        name=f"Source {source_id}",
        url=f"https://feeds.example.com/{source_id}.xml",
        category="Research",
        enabled=True,
        last_checked_at=None,
    )


def item(source_id: int, index: int) -> FeedItem:
    suffix = f"{source_id}-{index}"
    return FeedItem(
        title=f"Candidate {suffix} " + ("title-" * 22),
        url=f"https://example.com/{suffix}/" + ("path/" * 12),
        published_at=datetime(2026, 8, 28, 12, index, tzinfo=UTC),
        dedupe_key=f"candidate-{suffix}",
    )


class FakeRepository:
    def __init__(self) -> None:
        self.sources = [source(1), source(2), source(3)]
        self.posted: set[str] = set()

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


class PreviewHarness:
    def __init__(self) -> None:
        self.repository = FakeRepository()
        self.published: list[tuple[ManualFeedCandidate, ...]] = []
        self.feed_items = {
            source_id: [item(source_id, index) for index in range(10)] for source_id in (1, 2, 3)
        }

        async def fetch_items(record: AISourceRecord) -> list[FeedItem]:
            return list(self.feed_items[record.id])

        async def resolve_destination(guild_id: int) -> int | None:
            assert guild_id == GUILD_ID
            return DESTINATION_ID

        async def enabled(guild_id: int) -> bool:
            assert guild_id == GUILD_ID
            return True

        async def authorized(guild_id: int, actor_id: int) -> bool:
            assert guild_id == GUILD_ID
            assert actor_id == ACTOR_ID
            return True

        async def publish(
            guild_id: int,
            destination_id: int,
            candidates: tuple[ManualFeedCandidate, ...],
        ) -> int:
            assert guild_id == GUILD_ID
            assert destination_id == DESTINATION_ID
            self.published.append(candidates)
            self.repository.posted.update(candidate.dedupe_key for candidate in candidates)
            return len(candidates)

        self.service = ManualFeedPollingService(
            repository=self.repository,
            fetch_items=fetch_items,
            resolve_destination=resolve_destination,
            is_feature_enabled=enabled,
            can_manage_guild=authorized,
            publish_candidates=publish,
            clock=lambda: datetime(2026, 8, 28, 12, 0, tzinfo=UTC),
        )


@pytest.mark.asyncio
async def test_stored_preview_contains_only_candidates_rendered_in_full() -> None:
    harness = PreviewHarness()

    preview = await harness.service.preview(guild_id=GUILD_ID, actor_id=ACTOR_ID)
    rendered = _preview_embed(preview).description or ""

    assert 0 < len(preview.candidates) < 30, "an oversized tail must be deferred"
    assert "more candidate" not in rendered.lower()
    assert len(rendered) <= 4096
    for candidate in preview.candidates:
        assert candidate.source_name in rendered
        assert candidate.source_category in rendered
        assert candidate.title in rendered
        assert candidate.url in rendered
    assert harness.repository.posted == set()
    assert harness.published == []


@pytest.mark.asyncio
async def test_deferred_candidates_are_not_marked_and_appear_in_a_later_preview() -> None:
    harness = PreviewHarness()

    first = await harness.service.preview(guild_id=GUILD_ID, actor_id=ACTOR_ID)
    first_keys = {candidate.dedupe_key for candidate in first.candidates}
    assert 0 < len(first_keys) < 30
    assert harness.repository.posted == set()

    posted = await harness.service.post(first.token, guild_id=GUILD_ID, actor_id=ACTOR_ID)
    assert posted == len(first.candidates)
    assert harness.repository.posted == first_keys

    second = await harness.service.preview(guild_id=GUILD_ID, actor_id=ACTOR_ID)
    second_keys = {candidate.dedupe_key for candidate in second.candidates}
    assert second_keys
    assert first_keys.isdisjoint(second_keys)


class FailingPostService:
    async def post(self, token: str, *, guild_id: int, actor_id: int) -> int:
        assert token == "preview-token"
        assert guild_id == GUILD_ID
        assert actor_id == ACTOR_ID
        raise RuntimeError("sensitive internal publication detail")

    async def cancel(self, token: str, *, guild_id: int, actor_id: int) -> None:
        del token, guild_id, actor_id


class FakeResponse:
    def __init__(self) -> None:
        self.deferred = False

    async def defer(self, *, ephemeral: bool, thinking: bool) -> None:
        assert ephemeral is True
        assert thinking is True
        self.deferred = True


class FakeFollowup:
    def __init__(self) -> None:
        self.messages: list[str] = []

    async def send(self, content: str, *, ephemeral: bool) -> None:
        assert ephemeral is True
        self.messages.append(content)


class FakePromptMessage:
    def __init__(self) -> None:
        self.edits: list[dict[str, Any]] = []

    async def edit(self, **kwargs: Any) -> None:
        self.edits.append(kwargs)


def preview() -> ManualFeedPreview:
    return ManualFeedPreview(
        token="preview-token",
        guild_id=GUILD_ID,
        actor_id=ACTOR_ID,
        destination_id=DESTINATION_ID,
        candidates=(
            ManualFeedCandidate(
                source_id=1,
                source_name="Source",
                source_category="AI",
                title="Candidate",
                url="https://example.com/candidate",
                published_at=None,
                dedupe_key="candidate-1",
            ),
        ),
        expires_at=datetime(2026, 8, 28, 12, 1, tzinfo=UTC),
    )


@pytest.mark.asyncio
async def test_unexpected_post_failure_has_no_secondary_exception_or_false_success() -> None:
    view = ManualFeedPollView(service=cast(Any, FailingPostService()), preview=preview())
    prompt = FakePromptMessage()
    view.message = prompt  # type: ignore[assignment]
    interaction = SimpleNamespace(
        guild=SimpleNamespace(id=GUILD_ID),
        user=SimpleNamespace(id=ACTOR_ID),
        response=FakeResponse(),
        followup=FakeFollowup(),
    )
    post_button = next(item for item in view.children if getattr(item, "label", None) == "Post")

    await cast(Any, post_button).callback(cast(Any, interaction))

    assert interaction.response.deferred is True
    assert len(interaction.followup.messages) == 1
    user_message = interaction.followup.messages[0]
    assert "sensitive internal" not in user_message
    assert "new preview" in user_message.lower()
    assert "posted" not in user_message.lower()
    assert prompt.edits
    completion = str(prompt.edits[-1]["content"])
    assert "posted" not in completion.lower()
    assert "new preview" in completion.lower()
    assert view.is_finished()
