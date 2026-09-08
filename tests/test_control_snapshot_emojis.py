from types import SimpleNamespace
from typing import Any

from marwie_bot.features.control_plane.cog import ControlPlaneCog


class _Snapshots:
    async def build(self, guild: object) -> dict[str, Any]:
        return {"meta": {}}


class _Analytics:
    async def weekly(self, guild_id: int) -> object:
        assert guild_id == 123
        return SimpleNamespace(to_snapshot=lambda: {})


class _Repository:
    def __init__(self) -> None:
        self.saved: dict[str, Any] | None = None

    async def upsert_snapshot(self, guild_id: int, snapshot: dict[str, Any], worker_id: str) -> None:
        assert guild_id == 123
        assert worker_id == "test-worker"
        self.saved = snapshot


async def test_refresh_snapshot_includes_available_server_emojis(monkeypatch: Any) -> None:
    guild = SimpleNamespace(
        id=123,
        emojis=[
            SimpleNamespace(
                id=111,
                name="grok",
                animated=False,
                available=True,
                url="https://cdn.discordapp.com/emojis/111.webp",
            ),
            SimpleNamespace(
                id=222,
                name="party",
                animated=True,
                available=True,
                url="https://cdn.discordapp.com/emojis/222.gif",
            ),
            SimpleNamespace(
                id=333,
                name="unavailable",
                animated=False,
                available=False,
                url="https://cdn.discordapp.com/emojis/333.webp",
            ),
        ],
    )
    repository = _Repository()
    bot = SimpleNamespace(get_guild=lambda guild_id: guild if guild_id == 123 else None)
    cog = object.__new__(ControlPlaneCog)
    object.__setattr__(cog, "bot", bot)
    object.__setattr__(cog, "snapshots", _Snapshots())
    object.__setattr__(cog, "analytics", _Analytics())
    object.__setattr__(cog, "repository", repository)
    object.__setattr__(cog, "worker_id", "test-worker")
    monkeypatch.setattr(
        "marwie_bot.features.control_plane.cog.build_page_revisions",
        lambda snapshot: {},
    )

    await cog._refresh_snapshot(123)

    assert repository.saved is not None
    assert repository.saved["emojis"] == [
        {
            "id": "111",
            "name": "grok",
            "animated": False,
            "available": True,
            "url": "https://cdn.discordapp.com/emojis/111.webp",
        },
        {
            "id": "222",
            "name": "party",
            "animated": True,
            "available": True,
            "url": "https://cdn.discordapp.com/emojis/222.gif",
        },
    ]
