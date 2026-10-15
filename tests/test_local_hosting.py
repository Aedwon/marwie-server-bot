from __future__ import annotations

import plistlib
import stat
from pathlib import Path

import pytest

from scripts.local_hosting import (
    build_launch_agent,
    install_runtime,
    load_runtime_environment,
    production_env_template,
    runtime_command,
)


def _repo(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    (repo / ".venv" / "bin").mkdir(parents=True)
    (repo / ".venv" / "bin" / "python").write_text("python")
    (repo / ".env.example").write_text(
        "DISCORD_TOKEN=\n"
        "DATABASE_URL=sqlite+aiosqlite:///./data/marwie.db\n"
        "ENVIRONMENT=development\n"
        "LOG_LEVEL=INFO\n"
    )
    return repo


def test_production_env_template_forces_production_and_leaves_token_empty() -> None:
    example = (
        "DISCORD_TOKEN=old-placeholder\n"
        "DATABASE_URL=sqlite+aiosqlite:///./data/marwie.db\n"
        "ENVIRONMENT=development\n"
        "LOG_LEVEL=INFO\n"
    )

    rendered = production_env_template(example)

    assert "DISCORD_TOKEN=\n" in rendered
    assert "old-placeholder" not in rendered
    assert "ENVIRONMENT=production\n" in rendered
    assert "DATABASE_URL=sqlite+aiosqlite:///./data/marwie.db\n" in rendered
    assert "LOG_LEVEL=INFO\n" in rendered


def test_load_runtime_environment_rejects_empty_token(tmp_path: Path) -> None:
    env_path = tmp_path / "production.env"
    env_path.write_text("DISCORD_TOKEN=\nENVIRONMENT=production\n")

    with pytest.raises(RuntimeError, match="DISCORD_TOKEN is unset"):
        load_runtime_environment(env_path, {})


def test_load_runtime_environment_rejects_nonproduction_without_exposing_token(
    tmp_path: Path,
) -> None:
    env_path = tmp_path / "production.env"
    token = "super-secret-token-value"
    env_path.write_text(f"DISCORD_TOKEN={token}\nENVIRONMENT=development\n")

    with pytest.raises(RuntimeError) as exc_info:
        load_runtime_environment(env_path, {})

    assert "ENVIRONMENT must be production" in str(exc_info.value)
    assert token not in str(exc_info.value)


def test_load_runtime_environment_merges_valid_values(tmp_path: Path) -> None:
    env_path = tmp_path / "production.env"
    env_path.write_text("DISCORD_TOKEN=token-value\nENVIRONMENT=production\nLOG_LEVEL=DEBUG\n")

    loaded = load_runtime_environment(env_path, {"PATH": "/usr/bin"})

    assert loaded["PATH"] == "/usr/bin"
    assert loaded["DISCORD_TOKEN"] == "token-value"
    assert loaded["ENVIRONMENT"] == "production"
    assert loaded["LOG_LEVEL"] == "DEBUG"


def test_runtime_command_uses_caffeinate_and_repo_venv() -> None:
    repo = Path("/Users/aedwon/Documents/Projects/marwie-server-bot")

    assert runtime_command(repo) == [
        "/usr/bin/caffeinate",
        "-s",
        str(repo / ".venv" / "bin" / "python"),
        str(repo / "main.py"),
    ]


def test_launch_agent_has_restart_logs_and_no_secret_material() -> None:
    repo = Path("/Users/aedwon/Documents/Projects/marwie-server-bot")
    home = Path("/Users/aedwon")

    agent = build_launch_agent(repo, home)

    assert agent["Label"] == "com.aedwon.marwie-server-bot"
    assert agent["RunAtLoad"] is True
    assert agent["KeepAlive"] is True
    assert agent["ThrottleInterval"] == 15
    assert agent["WorkingDirectory"] == str(repo)
    assert agent["ProgramArguments"] == [
        str(repo / ".venv" / "bin" / "python"),
        str(repo / "scripts" / "local_hosting.py"),
        "run",
    ]
    assert agent["StandardOutPath"] == str(
        home / "Library" / "Logs" / "marwie-server-bot" / "stdout.log"
    )
    assert agent["StandardErrorPath"] == str(
        home / "Library" / "Logs" / "marwie-server-bot" / "stderr.log"
    )
    assert "DISCORD_TOKEN" not in repr(agent)


def test_install_creates_protected_env_and_valid_plist(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    home = tmp_path / "home"

    env_path, plist_path = install_runtime(repo, home)

    assert env_path.exists()
    assert stat.S_IMODE(env_path.stat().st_mode) == 0o600
    assert "DISCORD_TOKEN=\n" in env_path.read_text()
    assert "ENVIRONMENT=production\n" in env_path.read_text()
    with plist_path.open("rb") as handle:
        plist = plistlib.load(handle)
    assert plist == build_launch_agent(repo, home)
    assert "DISCORD_TOKEN" not in plist_path.read_text()


def test_install_never_overwrites_existing_environment(tmp_path: Path) -> None:
    repo = _repo(tmp_path)
    home = tmp_path / "home"
    env_path = home / ".config" / "marwie-server-bot" / "production.env"
    env_path.parent.mkdir(parents=True)
    original = "DISCORD_TOKEN=existing-token\nENVIRONMENT=production\n"
    env_path.write_text(original)
    env_path.chmod(0o600)

    installed_env_path, _ = install_runtime(repo, home)

    assert installed_env_path == env_path
    assert env_path.read_text() == original
    assert stat.S_IMODE(env_path.stat().st_mode) == 0o600
