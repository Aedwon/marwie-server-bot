"""Add browser control plane tables.

Revision ID: 20260827_0003
Revises: 20260822_0002
Create Date: 2026-08-27
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260827_0003"
down_revision: str | None = "20260822_0002"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "control_sessions",
        sa.Column("session_hash", sa.String(length=64), nullable=False),
        sa.Column("csrf_hash", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("username", sa.String(length=100), nullable=False),
        sa.Column("avatar_url", sa.String(length=1000), nullable=True),
        sa.Column("guilds_json", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("session_hash"),
    )
    op.create_index("ix_control_sessions_user_id", "control_sessions", ["user_id"], unique=False)
    op.create_index(
        "ix_control_sessions_expires_at", "control_sessions", ["expires_at"], unique=False
    )

    op.create_table(
        "control_actions",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("guild_id", sa.BigInteger(), nullable=False),
        sa.Column("actor_id", sa.BigInteger(), nullable=False),
        sa.Column("action_type", sa.String(length=64), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("idempotency_key", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("claimed_by", sa.String(length=100), nullable=True),
        sa.Column("result_json", sa.JSON(), nullable=True),
        sa.Column("user_error", sa.Text(), nullable=True),
        sa.Column("error_reference", sa.String(length=32), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "guild_id",
            "actor_id",
            "idempotency_key",
            name="uq_control_actions_actor_idempotency",
        ),
    )
    op.create_index("ix_control_actions_guild_id", "control_actions", ["guild_id"], unique=False)
    op.create_index("ix_control_actions_actor_id", "control_actions", ["actor_id"], unique=False)
    op.create_index(
        "ix_control_actions_action_type", "control_actions", ["action_type"], unique=False
    )
    op.create_index("ix_control_actions_status", "control_actions", ["status"], unique=False)
    op.create_index(
        "ix_control_actions_created_at", "control_actions", ["created_at"], unique=False
    )

    op.create_table(
        "control_guild_snapshots",
        sa.Column("guild_id", sa.BigInteger(), nullable=False),
        sa.Column("snapshot_json", sa.JSON(), nullable=False),
        sa.Column("worker_version", sa.String(length=100), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("guild_id"),
    )

    op.create_table(
        "notification_role_panels",
        sa.Column("guild_id", sa.BigInteger(), nullable=False),
        sa.Column("channel_id", sa.BigInteger(), nullable=False),
        sa.Column("message_id", sa.BigInteger(), nullable=True),
        sa.Column("title", sa.String(length=256), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("updated_by", sa.BigInteger(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("guild_id"),
    )

    op.create_table(
        "notification_role_buttons",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("guild_id", sa.BigInteger(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("role_id", sa.BigInteger(), nullable=False),
        sa.Column("label", sa.String(length=80), nullable=False),
        sa.Column("emoji", sa.String(length=32), nullable=True),
        sa.Column("style", sa.String(length=16), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "guild_id", "position", name="uq_notification_role_buttons_guild_position"
        ),
        sa.UniqueConstraint(
            "guild_id", "role_id", name="uq_notification_role_buttons_guild_role"
        ),
    )
    op.create_index(
        "ix_notification_role_buttons_guild_id",
        "notification_role_buttons",
        ["guild_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_notification_role_buttons_guild_id", table_name="notification_role_buttons")
    op.drop_table("notification_role_buttons")
    op.drop_table("notification_role_panels")
    op.drop_table("control_guild_snapshots")
    op.drop_index("ix_control_actions_created_at", table_name="control_actions")
    op.drop_index("ix_control_actions_status", table_name="control_actions")
    op.drop_index("ix_control_actions_action_type", table_name="control_actions")
    op.drop_index("ix_control_actions_actor_id", table_name="control_actions")
    op.drop_index("ix_control_actions_guild_id", table_name="control_actions")
    op.drop_table("control_actions")
    op.drop_index("ix_control_sessions_expires_at", table_name="control_sessions")
    op.drop_index("ix_control_sessions_user_id", table_name="control_sessions")
    op.drop_table("control_sessions")
