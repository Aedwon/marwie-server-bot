"""Create compromised-account trap incidents.

Revision ID: 20260909_0006
Revises: 20260908_0005
Create Date: 2026-09-09
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260909_0006"
down_revision: str | None = "20260908_0005"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "compromised_account_incidents",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("guild_id", sa.BigInteger(), nullable=False),
        sa.Column("target_id", sa.BigInteger(), nullable=False),
        sa.Column("trigger_channel_id", sa.BigInteger(), nullable=False),
        sa.Column("trigger_message_id", sa.BigInteger(), nullable=False),
        sa.Column("triggered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("containment_status", sa.String(length=32), nullable=True),
        sa.Column("ban_status", sa.String(length=32), nullable=True),
        sa.Column("ban_error", sa.Text(), nullable=True),
        sa.Column(
            "native_delete_requested",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
        sa.Column(
            "fallback_cleanup_run",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
        sa.Column(
            "deleted_message_count",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column("failed_scopes_json", sa.JSON(), nullable=True),
        sa.Column("active_key", sa.String(length=100), nullable=True),
        sa.Column("cooldown_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "trigger_message_id",
            name="uq_compromised_account_incidents_trigger_message_id",
        ),
        sa.UniqueConstraint(
            "active_key",
            name="uq_compromised_account_incidents_active_key",
        ),
    )
    op.create_index(
        "ix_compromised_account_incidents_guild_id",
        "compromised_account_incidents",
        ["guild_id"],
        unique=False,
    )
    op.create_index(
        "ix_compromised_account_incidents_target_id",
        "compromised_account_incidents",
        ["target_id"],
        unique=False,
    )
    op.create_index(
        "ix_compromised_account_incidents_cooldown_until",
        "compromised_account_incidents",
        ["cooldown_until"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_compromised_account_incidents_cooldown_until",
        table_name="compromised_account_incidents",
    )
    op.drop_index(
        "ix_compromised_account_incidents_target_id",
        table_name="compromised_account_incidents",
    )
    op.drop_index(
        "ix_compromised_account_incidents_guild_id",
        table_name="compromised_account_incidents",
    )
    op.drop_table("compromised_account_incidents")
