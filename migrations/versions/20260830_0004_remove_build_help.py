"""Remove retired Build Help persistence and stale configuration.

Revision ID: 20260830_0004
Revises: 20260827_0003
Create Date: 2026-08-30
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260830_0004"
down_revision: str | None = "20260827_0003"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    solution_count = int(bind.execute(sa.text("SELECT COUNT(*) FROM forum_solutions")).scalar_one())
    if solution_count > 0:
        raise RuntimeError(
            "Wave 11 cleanup aborted: forum_solutions contains "
            f"{solution_count} row(s); no destructive Build Help cleanup was performed."
        )

    bind.execute(sa.text("DELETE FROM feature_flags WHERE feature = 'build_help'"))
    bind.execute(
        sa.text("DELETE FROM guild_resources WHERE key IN ('build_help_forum', 'solved_tag')")
    )
    op.drop_index("ix_forum_solutions_helper_id", table_name="forum_solutions")
    op.drop_index("ix_forum_solutions_thread_id", table_name="forum_solutions")
    op.drop_index("ix_forum_solutions_guild_id", table_name="forum_solutions")
    op.drop_table("forum_solutions")


def downgrade() -> None:
    op.create_table(
        "forum_solutions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("guild_id", sa.BigInteger(), nullable=False),
        sa.Column("thread_id", sa.BigInteger(), nullable=False),
        sa.Column("answer_message_id", sa.BigInteger(), nullable=False),
        sa.Column("helper_id", sa.BigInteger(), nullable=False),
        sa.Column("solved_by", sa.BigInteger(), nullable=False),
        sa.Column("question_title", sa.String(length=200), nullable=False),
        sa.Column("answer_excerpt", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("guild_id", "thread_id", name="uq_solution_guild_thread"),
    )
    op.create_index("ix_forum_solutions_guild_id", "forum_solutions", ["guild_id"], unique=False)
    op.create_index("ix_forum_solutions_thread_id", "forum_solutions", ["thread_id"], unique=False)
    op.create_index("ix_forum_solutions_helper_id", "forum_solutions", ["helper_id"], unique=False)
