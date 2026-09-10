"""Create anonymous messages and panel state.

Revision ID: 20260909_0007
Revises: 20260909_0006
Create Date: 2026-09-09
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260909_0007"
down_revision: str | None = "20260909_0006"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "anonymous_messages",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("guild_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("channel_id", sa.BigInteger(), nullable=False),
        sa.Column("message_id", sa.BigInteger(), nullable=True),
        sa.Column("kind", sa.String(length=16), nullable=False),
        sa.Column("display_number", sa.Integer(), nullable=True),
        sa.Column("reply_to_message_id", sa.BigInteger(), nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("message_id", name="uq_anonymous_messages_message_id"),
    )
    op.create_index(
        "ix_anonymous_messages_guild_id",
        "anonymous_messages",
        ["guild_id"],
        unique=False,
    )
    op.create_index(
        "ix_anonymous_messages_user_id",
        "anonymous_messages",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_anonymous_messages_message_id",
        "anonymous_messages",
        ["message_id"],
        unique=False,
    )
    op.create_index(
        "ix_anonymous_messages_kind",
        "anonymous_messages",
        ["kind"],
        unique=False,
    )
    op.create_index(
        "ix_anonymous_messages_deleted_at",
        "anonymous_messages",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        "ix_anonymous_messages_created_at",
        "anonymous_messages",
        ["created_at"],
        unique=False,
    )

    op.create_table(
        "anonymous_message_panels",
        sa.Column("guild_id", sa.BigInteger(), nullable=False),
        sa.Column("channel_id", sa.BigInteger(), nullable=False),
        sa.Column("message_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("guild_id"),
    )


def downgrade() -> None:
    op.drop_table("anonymous_message_panels")
    op.drop_index("ix_anonymous_messages_created_at", table_name="anonymous_messages")
    op.drop_index("ix_anonymous_messages_deleted_at", table_name="anonymous_messages")
    op.drop_index("ix_anonymous_messages_kind", table_name="anonymous_messages")
    op.drop_index("ix_anonymous_messages_message_id", table_name="anonymous_messages")
    op.drop_index("ix_anonymous_messages_user_id", table_name="anonymous_messages")
    op.drop_index("ix_anonymous_messages_guild_id", table_name="anonymous_messages")
    op.drop_table("anonymous_messages")
