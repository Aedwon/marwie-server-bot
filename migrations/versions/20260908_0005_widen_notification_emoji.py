"""Widen notification role button emoji storage.

Revision ID: 20260908_0005
Revises: 20260830_0004
Create Date: 2026-09-08
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260908_0005"
down_revision: str | None = "20260830_0004"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("notification_role_buttons") as batch_op:
        batch_op.alter_column(
            "emoji",
            existing_type=sa.String(length=32),
            type_=sa.String(length=100),
            existing_nullable=True,
        )


def downgrade() -> None:
    with op.batch_alter_table("notification_role_buttons") as batch_op:
        batch_op.alter_column(
            "emoji",
            existing_type=sa.String(length=100),
            type_=sa.String(length=32),
            existing_nullable=True,
        )
