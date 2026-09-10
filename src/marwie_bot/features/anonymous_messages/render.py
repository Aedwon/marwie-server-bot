from __future__ import annotations

from datetime import UTC, datetime

import discord


def _guild_icon_url(guild: discord.Guild) -> str | None:
    return guild.icon.url if guild.icon is not None else None


def build_panel_embed(guild: discord.Guild) -> discord.Embed:
    embed = discord.Embed(
        title="📨 Anonymous Messages",
        description=(
            "Have something to say? Share it anonymously.\n\n"
            "Click the button below to post an anonymous message. Your identity is "
            "**hidden from other members**.\n\n"
            "You can also reply anonymously to any anonymous message using its reply button."
        ),
        color=discord.Color.blurple(),
    )
    icon_url = _guild_icon_url(guild)
    if icon_url is not None:
        embed.set_thumbnail(url=icon_url)
    embed.set_footer(text="This panel refreshes every 10 minutes • Rob-bot")
    return embed


def build_message_embed(guild: discord.Guild, number: int, content: str) -> discord.Embed:
    embed = discord.Embed(
        title=f"Anonymous Message #{number}",
        description=content,
        color=discord.Color.blurple(),
        timestamp=datetime.now(UTC),
    )
    icon_url = _guild_icon_url(guild)
    if icon_url is None:
        embed.set_author(name="Anonymous")
    else:
        embed.set_author(name="Anonymous", icon_url=icon_url)
    embed.set_footer(text="Click below to reply anonymously")
    return embed


def build_reply_embed(guild: discord.Guild, content: str) -> discord.Embed:
    embed = discord.Embed(
        description=content,
        color=discord.Color.greyple(),
        timestamp=datetime.now(UTC),
    )
    icon_url = _guild_icon_url(guild)
    if icon_url is None:
        embed.set_author(name="Anonymous Reply")
    else:
        embed.set_author(name="Anonymous Reply", icon_url=icon_url)
    return embed


def build_audit_embed(
    *,
    user: discord.User | discord.Member,
    action_type: str,
    content: str,
    public_channel: discord.TextChannel,
    reference_label: str | None = None,
) -> discord.Embed:
    audit_content = content if len(content) <= 1024 else content[:1021] + "..."
    embed = discord.Embed(
        title=f"🔒 {action_type}",
        description=audit_content,
        color=discord.Color.orange(),
        timestamp=datetime.now(UTC),
    )
    embed.add_field(name="Author", value=f"{user.mention} (`{user.id}`)", inline=True)
    embed.add_field(name="Channel", value=public_channel.mention, inline=True)
    if reference_label is not None:
        embed.add_field(name="Context", value=reference_label, inline=False)
    embed.set_author(name=str(user), icon_url=user.display_avatar.url)
    embed.set_footer(text="Anonymous Activity Log • Rob-bot")
    return embed
