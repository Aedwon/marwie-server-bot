from types import SimpleNamespace
from typing import Any

import discord

from marwie_bot.features.anonymous_messages import cog as cog_module
from marwie_bot.features.anonymous_messages.cog import AnonymousMessagesCog
from marwie_bot.features.anonymous_messages.service import RenumberItem
from marwie_bot.features.anonymous_messages.views import AnonymousMessageDestinations


class _Service:
    def __init__(self) -> None:
        self.deleted: list[tuple[int, int]] = []
        self.panel: object | None = None
        self.saved_panels: list[tuple[int, int, int]] = []
        self.display_updates: list[tuple[int, int]] = []
        self.plan: list[RenumberItem] = []

    async def mark_deleted_by_message(self, guild_id: int, message_id: int) -> bool:
        self.deleted.append((guild_id, message_id))
        remaining = [item for item in self.plan if item.message_id != message_id]
        self.plan = [
            RenumberItem(
                item.record_id,
                item.message_id,
                item.current_number,
                expected_number,
            )
            for expected_number, item in enumerate(remaining, start=1)
        ]
        return True

    async def get_panel(self, guild_id: int) -> object | None:
        assert guild_id == 1
        return self.panel

    async def save_panel(self, guild_id: int, channel_id: int, message_id: int) -> object:
        self.saved_panels.append((guild_id, channel_id, message_id))
        self.panel = SimpleNamespace(
            guild_id=guild_id,
            channel_id=channel_id,
            message_id=message_id,
        )
        return self.panel

    async def clear_panel(self, guild_id: int) -> bool:
        self.panel = None
        return True

    async def renumber_plan(self, guild_id: int) -> list[RenumberItem]:
        assert guild_id == 1
        return list(self.plan)

    async def set_display_number(self, record_id: int, display_number: int) -> object:
        self.display_updates.append((record_id, display_number))
        self.plan = [
            RenumberItem(
                item.record_id,
                item.message_id,
                display_number if item.record_id == record_id else item.current_number,
                item.expected_number,
            )
            for item in self.plan
        ]
        return SimpleNamespace(id=record_id, display_number=display_number)


class _Resources:
    def __init__(self, submissions_id: int = 102) -> None:
        self.submissions_id = submissions_id

    async def get(self, guild_id: int, key: Any) -> object | None:
        assert guild_id == 1
        if key.value == "anon_messages_submissions":
            return SimpleNamespace(discord_id=self.submissions_id)
        return None


class _Features:
    async def is_enabled(self, guild_id: int, feature: Any) -> bool:
        assert guild_id == 1
        assert feature.value == "anonymous_messages"
        return True


class _Message:
    def __init__(self, message_id: int, title: str | None = None) -> None:
        self.id = message_id
        self.deleted = False
        self.edits: list[discord.Embed] = []
        self.embeds = [discord.Embed(title=title)] if title is not None else []

    async def delete(self) -> None:
        self.deleted = True

    async def edit(self, *, embed: discord.Embed) -> None:
        self.edits.append(embed)
        self.embeds = [embed]


class _Channel:
    def __init__(
        self,
        channel_id: int,
        *,
        messages: dict[int, _Message] | None = None,
        read_history: bool = True,
    ) -> None:
        self.id = channel_id
        self.name = f"channel-{channel_id}"
        self.mention = f"<#{channel_id}>"
        self.guild = SimpleNamespace(id=1)
        self.messages = messages or {}
        self.sent: list[dict[str, Any]] = []
        self.latest_message_id: int | None = None
        self.read_history = read_history

    def history(self, *, limit: int) -> Any:
        assert limit == 1

        async def iterate() -> Any:
            if self.latest_message_id is not None:
                yield self.messages[self.latest_message_id]

        return iterate()

    async def fetch_message(self, message_id: int) -> _Message:
        message = self.messages.get(message_id)
        if message is None:
            raise discord.NotFound(SimpleNamespace(status=404, reason="Not Found"), "missing")
        return message

    async def send(self, **kwargs: Any) -> object:
        message_id = 900 + len(self.sent)
        self.sent.append(kwargs)
        message = _Message(message_id)
        self.messages[message_id] = message
        self.latest_message_id = message_id
        return message

    def permissions_for(self, member: object) -> object:
        del member
        return SimpleNamespace(
            view_channel=True,
            send_messages=True,
            embed_links=True,
            manage_messages=True,
            read_message_history=self.read_history,
        )


def _bot(*, background: bool = False) -> object:
    views: list[object] = []
    return SimpleNamespace(
        settings=SimpleNamespace(enable_background_tasks=background),
        add_view=lambda view: views.append(view),
        registered_views=views,
        guilds=[],
        user=SimpleNamespace(id=999),
        get_guild=lambda guild_id: None,
        wait_until_ready=lambda: None,
    )


def _cog(bot: object | None = None) -> AnonymousMessagesCog:
    return AnonymousMessagesCog(
        bot=bot or _bot(),
        service=_Service(),
        resources=_Resources(),
        features=_Features(),
    )


async def test_cog_load_registers_both_persistent_views_without_starting_disabled_workers() -> None:
    bot = _bot(background=False)
    cog = _cog(bot)

    await cog.cog_load()

    assert [type(view).__name__ for view in bot.registered_views] == ["AnonPanelView", "AnonReplyView"]
    assert not cog.sticky_repost.is_running()
    assert not cog.sync_queue_worker.is_running()


async def test_single_delete_in_current_submissions_channel_is_tracked_and_queued() -> None:
    cog = _cog()
    payload = SimpleNamespace(guild_id=1, channel_id=102, message_id=501)

    await cog.on_raw_message_delete(payload)

    assert cog.service.deleted == [(1, 501)]
    assert cog.pending_sync_guilds == {1}


async def test_delete_in_old_or_unrelated_channel_is_ignored() -> None:
    cog = _cog()
    payload = SimpleNamespace(guild_id=1, channel_id=999, message_id=501)

    await cog.on_raw_message_delete(payload)

    assert cog.service.deleted == []
    assert cog.pending_sync_guilds == set()


async def test_bulk_delete_tracks_each_message_and_queues_guild_once() -> None:
    cog = _cog()
    payload = SimpleNamespace(guild_id=1, channel_id=102, message_ids={501, 502, 503})

    await cog.on_raw_bulk_message_delete(payload)

    assert sorted(cog.service.deleted) == [(1, 501), (1, 502), (1, 503)]
    assert cog.pending_sync_guilds == {1}


async def test_moved_panel_mapping_deletes_old_tracked_panel_before_reposting(
    monkeypatch: Any,
) -> None:
    service = _Service()
    old_message = _Message(700)
    old_channel = _Channel(101, messages={700: old_message})
    new_channel = _Channel(201)
    submissions = _Channel(202)
    audit = _Channel(203)
    guild = SimpleNamespace(
        id=1,
        me=SimpleNamespace(id=999),
        icon=None,
        get_channel=lambda channel_id: {
            101: old_channel,
            201: new_channel,
            202: submissions,
            203: audit,
        }.get(channel_id),
    )
    service.panel = SimpleNamespace(guild_id=1, channel_id=101, message_id=700)
    destinations = AnonymousMessageDestinations(new_channel, submissions, audit)

    async def fake_resolve(guild_arg: object, resources_arg: object) -> object:
        assert guild_arg is guild
        return destinations

    monkeypatch.setattr(cog_module, "resolve_destinations", fake_resolve)
    cog = AnonymousMessagesCog(_bot(), service, _Resources(), _Features())

    changed = await cog._ensure_panel(guild)

    assert changed is True
    assert old_message.deleted is True
    assert len(new_channel.sent) == 1
    assert service.saved_panels == [(1, 201, 900)]


async def test_panel_is_not_reposted_when_tracked_panel_is_already_latest(monkeypatch: Any) -> None:
    service = _Service()
    panel_message = _Message(700)
    panel_channel = _Channel(101, messages={700: panel_message})
    panel_channel.latest_message_id = 700
    submissions = _Channel(102)
    audit = _Channel(103)
    guild = SimpleNamespace(id=1, me=SimpleNamespace(id=999), icon=None)
    service.panel = SimpleNamespace(guild_id=1, channel_id=101, message_id=700)

    async def fake_resolve(guild_arg: object, resources_arg: object) -> object:
        return AnonymousMessageDestinations(panel_channel, submissions, audit)

    monkeypatch.setattr(cog_module, "resolve_destinations", fake_resolve)
    cog = AnonymousMessagesCog(_bot(), service, _Resources(), _Features())

    changed = await cog._ensure_panel(guild)

    assert changed is False
    assert panel_channel.sent == []


def test_panel_reconciliation_requires_read_message_history() -> None:
    guild = SimpleNamespace(me=object())

    assert AnonymousMessagesCog._panel_permissions_ok(_Channel(101), guild) is True
    assert (
        AnonymousMessagesCog._panel_permissions_ok(
            _Channel(101, read_history=False),
            guild,
        )
        is False
    )


async def test_full_sync_edits_only_wrong_numbers_and_persists_corrected_number(
    monkeypatch: Any,
) -> None:
    service = _Service()
    first = _Message(501, "Anonymous Message #1")
    third = _Message(503, "Anonymous Message #3")
    submissions = _Channel(102, messages={501: first, 503: third})
    guild = SimpleNamespace(id=1)
    service.plan = [
        RenumberItem(1, 501, 1, 1),
        RenumberItem(3, 503, 3, 2),
    ]

    async def fake_submission(guild_arg: object) -> object:
        return submissions

    async def no_sleep(seconds: float) -> None:
        assert seconds == 2

    monkeypatch.setattr(cog_module.asyncio, "sleep", no_sleep)
    cog = AnonymousMessagesCog(_bot(), service, _Resources(), _Features())
    cog._submissions_channel = fake_submission

    result = await cog._run_full_sync(guild)

    assert result.total == 2
    assert result.corrected == 1
    assert first.edits == []
    assert third.edits[0].title == "Anonymous Message #2"
    assert service.display_updates == [(3, 2)]


async def test_full_sync_discovers_offline_delete_even_when_number_was_correct(
    monkeypatch: Any,
) -> None:
    service = _Service()
    second = _Message(502, "Anonymous Message #2")
    submissions = _Channel(102, messages={502: second})
    guild = SimpleNamespace(id=1)
    service.plan = [
        RenumberItem(1, 501, 1, 1),
        RenumberItem(2, 502, 2, 2),
    ]

    async def fake_submission(guild_arg: object) -> object:
        return submissions

    async def no_sleep(seconds: float) -> None:
        assert seconds == 2

    monkeypatch.setattr(cog_module.asyncio, "sleep", no_sleep)
    cog = AnonymousMessagesCog(_bot(), service, _Resources(), _Features())
    cog._submissions_channel = fake_submission

    result = await cog._run_full_sync(guild)

    assert service.deleted == [(1, 501)]
    assert second.edits[0].title == "Anonymous Message #1"
    assert service.display_updates == [(2, 1)]
    assert result.total == 1
    assert result.corrected == 1


def test_admin_commands_have_runtime_administrator_checks() -> None:
    deploy = AnonymousMessagesCog.anon_group.get_command("deploy")
    sync = AnonymousMessagesCog.anon_group.get_command("sync")

    assert deploy is not None and sync is not None
    assert deploy.default_permissions is not None
    assert sync.default_permissions is not None
    assert deploy.default_permissions.administrator is True
    assert sync.default_permissions.administrator is True
    assert deploy.checks
    assert sync.checks
