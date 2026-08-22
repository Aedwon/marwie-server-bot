"""Add complete V1 feature tables.

Revision ID: 20260822_0002
Revises: 20260822_0001
Create Date: 2026-08-22
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260822_0002"
down_revision: str | None = "20260822_0001"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ticket_types",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("guild_id", sa.BigInteger(), nullable=False),
        sa.Column("key", sa.String(length=50), nullable=False),
        sa.Column("label", sa.String(length=80), nullable=False),
        sa.Column("description", sa.String(length=200), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("guild_id", "key", name="uq_ticket_types_guild_key"),
    )
    op.create_index("ix_ticket_types_guild_id", "ticket_types", ["guild_id"], unique=False)
    op.create_table(
        "tickets",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("guild_id", sa.BigInteger(), nullable=False),
        sa.Column("channel_id", sa.BigInteger(), nullable=False),
        sa.Column("opener_id", sa.BigInteger(), nullable=False),
        sa.Column("type_key", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("claimed_by", sa.BigInteger(), nullable=True),
        sa.Column("closed_by", sa.BigInteger(), nullable=True),
        sa.Column("close_reason", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("channel_id"),
    )
    op.create_index("ix_tickets_guild_id", "tickets", ["guild_id"], unique=False)
    op.create_index("ix_tickets_opener_id", "tickets", ["opener_id"], unique=False)
    op.create_index("ix_tickets_status", "tickets", ["status"], unique=False)
    op.create_table(
        "ticket_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("ticket_id", sa.Integer(), nullable=False),
        sa.Column("guild_id", sa.BigInteger(), nullable=False),
        sa.Column("actor_id", sa.BigInteger(), nullable=True),
        sa.Column("event", sa.String(length=32), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["ticket_id"], ["tickets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ticket_events_ticket_id", "ticket_events", ["ticket_id"], unique=False)
    op.create_index("ix_ticket_events_guild_id", "ticket_events", ["guild_id"], unique=False)
    op.create_table(
        "temporary_voice_channels",
        sa.Column("channel_id", sa.BigInteger(), nullable=False),
        sa.Column("guild_id", sa.BigInteger(), nullable=False),
        sa.Column("owner_id", sa.BigInteger(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("channel_id"),
    )
    op.create_index(
        "ix_temporary_voice_channels_guild_id",
        "temporary_voice_channels",
        ["guild_id"],
        unique=False,
    )
    op.create_table(
        "reputation_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("guild_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("kind", sa.String(length=50), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("actor_id", sa.BigInteger(), nullable=True),
        sa.Column("source_ref", sa.String(length=200), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_reputation_events_guild_id", "reputation_events", ["guild_id"], unique=False
    )
    op.create_index("ix_reputation_events_user_id", "reputation_events", ["user_id"], unique=False)
    op.create_index(
        "ix_reputation_events_created_at", "reputation_events", ["created_at"], unique=False
    )
    op.create_table(
        "reputation_totals",
        sa.Column("guild_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("total_points", sa.Integer(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("guild_id", "user_id"),
    )
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
    op.create_table(
        "quiz_questions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("guild_id", sa.BigInteger(), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=False),
        sa.Column("option_a", sa.String(length=300), nullable=False),
        sa.Column("option_b", sa.String(length=300), nullable=False),
        sa.Column("option_c", sa.String(length=300), nullable=False),
        sa.Column("option_d", sa.String(length=300), nullable=False),
        sa.Column("correct_index", sa.Integer(), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_quiz_questions_guild_id", "quiz_questions", ["guild_id"], unique=False)
    op.create_table(
        "quiz_sessions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("guild_id", sa.BigInteger(), nullable=False),
        sa.Column("channel_id", sa.BigInteger(), nullable=False),
        sa.Column("message_id", sa.BigInteger(), nullable=True),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closes_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["question_id"], ["quiz_questions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("message_id"),
    )
    op.create_index("ix_quiz_sessions_guild_id", "quiz_sessions", ["guild_id"], unique=False)
    op.create_index("ix_quiz_sessions_status", "quiz_sessions", ["status"], unique=False)
    op.create_table(
        "quiz_answers",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("guild_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("answer_index", sa.Integer(), nullable=False),
        sa.Column("is_correct", sa.Boolean(), nullable=False),
        sa.Column(
            "answered_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["session_id"], ["quiz_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "user_id", name="uq_quiz_answer_user"),
    )
    op.create_index("ix_quiz_answers_session_id", "quiz_answers", ["session_id"], unique=False)
    op.create_index("ix_quiz_answers_guild_id", "quiz_answers", ["guild_id"], unique=False)
    op.create_index("ix_quiz_answers_user_id", "quiz_answers", ["user_id"], unique=False)
    op.create_table(
        "anonymous_questions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("guild_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("channel_id", sa.BigInteger(), nullable=False),
        sa.Column("message_id", sa.BigInteger(), nullable=True),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_anonymous_questions_guild_id", "anonymous_questions", ["guild_id"], unique=False
    )
    op.create_index(
        "ix_anonymous_questions_user_id", "anonymous_questions", ["user_id"], unique=False
    )
    op.create_index(
        "ix_anonymous_questions_created_at", "anonymous_questions", ["created_at"], unique=False
    )
    op.create_table(
        "pomodoro_sessions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("guild_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("channel_id", sa.BigInteger(), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_pomodoro_sessions_guild_id", "pomodoro_sessions", ["guild_id"], unique=False
    )
    op.create_index("ix_pomodoro_sessions_user_id", "pomodoro_sessions", ["user_id"], unique=False)
    op.create_index("ix_pomodoro_sessions_status", "pomodoro_sessions", ["status"], unique=False)
    op.create_table(
        "ai_update_sources",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("guild_id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("url", sa.String(length=1000), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("guild_id", "url", name="uq_ai_source_guild_url"),
    )
    op.create_index(
        "ix_ai_update_sources_guild_id", "ai_update_sources", ["guild_id"], unique=False
    )
    op.create_table(
        "ai_update_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("guild_id", sa.BigInteger(), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("dedupe_key", sa.String(length=128), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("url", sa.String(length=1500), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("posted_message_id", sa.BigInteger(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["source_id"], ["ai_update_sources.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("guild_id", "dedupe_key", name="uq_ai_item_guild_key"),
    )
    op.create_index("ix_ai_update_items_guild_id", "ai_update_items", ["guild_id"], unique=False)
    op.create_index("ix_ai_update_items_source_id", "ai_update_items", ["source_id"], unique=False)
    op.create_table(
        "showcase_spotlights",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("guild_id", sa.BigInteger(), nullable=False),
        sa.Column("thread_id", sa.BigInteger(), nullable=False),
        sa.Column("posted_message_id", sa.BigInteger(), nullable=True),
        sa.Column("selected_by", sa.BigInteger(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_showcase_spotlights_guild_id", "showcase_spotlights", ["guild_id"], unique=False
    )
    op.create_index(
        "ix_showcase_spotlights_thread_id", "showcase_spotlights", ["thread_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_showcase_spotlights_thread_id", table_name="showcase_spotlights")
    op.drop_index("ix_showcase_spotlights_guild_id", table_name="showcase_spotlights")
    op.drop_table("showcase_spotlights")
    op.drop_index("ix_ai_update_items_source_id", table_name="ai_update_items")
    op.drop_index("ix_ai_update_items_guild_id", table_name="ai_update_items")
    op.drop_table("ai_update_items")
    op.drop_index("ix_ai_update_sources_guild_id", table_name="ai_update_sources")
    op.drop_table("ai_update_sources")
    op.drop_index("ix_pomodoro_sessions_status", table_name="pomodoro_sessions")
    op.drop_index("ix_pomodoro_sessions_user_id", table_name="pomodoro_sessions")
    op.drop_index("ix_pomodoro_sessions_guild_id", table_name="pomodoro_sessions")
    op.drop_table("pomodoro_sessions")
    op.drop_index("ix_anonymous_questions_created_at", table_name="anonymous_questions")
    op.drop_index("ix_anonymous_questions_user_id", table_name="anonymous_questions")
    op.drop_index("ix_anonymous_questions_guild_id", table_name="anonymous_questions")
    op.drop_table("anonymous_questions")
    op.drop_index("ix_quiz_answers_user_id", table_name="quiz_answers")
    op.drop_index("ix_quiz_answers_guild_id", table_name="quiz_answers")
    op.drop_index("ix_quiz_answers_session_id", table_name="quiz_answers")
    op.drop_table("quiz_answers")
    op.drop_index("ix_quiz_sessions_status", table_name="quiz_sessions")
    op.drop_index("ix_quiz_sessions_guild_id", table_name="quiz_sessions")
    op.drop_table("quiz_sessions")
    op.drop_index("ix_quiz_questions_guild_id", table_name="quiz_questions")
    op.drop_table("quiz_questions")
    op.drop_index("ix_forum_solutions_helper_id", table_name="forum_solutions")
    op.drop_index("ix_forum_solutions_thread_id", table_name="forum_solutions")
    op.drop_index("ix_forum_solutions_guild_id", table_name="forum_solutions")
    op.drop_table("forum_solutions")
    op.drop_table("reputation_totals")
    op.drop_index("ix_reputation_events_created_at", table_name="reputation_events")
    op.drop_index("ix_reputation_events_user_id", table_name="reputation_events")
    op.drop_index("ix_reputation_events_guild_id", table_name="reputation_events")
    op.drop_table("reputation_events")
    op.drop_index("ix_temporary_voice_channels_guild_id", table_name="temporary_voice_channels")
    op.drop_table("temporary_voice_channels")
    op.drop_index("ix_ticket_events_guild_id", table_name="ticket_events")
    op.drop_index("ix_ticket_events_ticket_id", table_name="ticket_events")
    op.drop_table("ticket_events")
    op.drop_index("ix_tickets_status", table_name="tickets")
    op.drop_index("ix_tickets_opener_id", table_name="tickets")
    op.drop_index("ix_tickets_guild_id", table_name="tickets")
    op.drop_table("tickets")
    op.drop_index("ix_ticket_types_guild_id", table_name="ticket_types")
    op.drop_table("ticket_types")
