from __future__ import annotations

import discord

from marwie_bot.features.live_announcements.service import LiveAnnouncementDraft


def build_live_embed(draft: LiveAnnouncementDraft) -> discord.Embed:
    description = "Mar Wie is live now. Join the stream to learn and follow along."
    if draft.topic is not None:
        topic = discord.utils.escape_mentions(draft.topic)
        description = f"**Topic:** {topic}\n\n{description}"

    embed = discord.Embed(
        title=draft.title,
        description=description,
        color=discord.Color.from_rgb(255, 0, 80),
    )
    embed.set_footer(text="Rob-bot live notification")
    return embed


def build_live_view(draft: LiveAnnouncementDraft) -> discord.ui.View | None:
    if draft.tiktok_url is None:
        return None

    view = discord.ui.View(timeout=None)
    view.add_item(
        discord.ui.Button(
            label="Watch on TikTok",
            style=discord.ButtonStyle.link,
            url=draft.tiktok_url,
        )
    )
    return view
