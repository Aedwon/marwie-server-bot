from __future__ import annotations

import argparse
import os
import plistlib
import stat
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path

from dotenv import dotenv_values

LABEL = "com.aedwon.marwie-server-bot"
CAFFEINATE = Path("/usr/bin/caffeinate")


def production_env_template(example: str) -> str:
    lines = example.splitlines()
    saw_token = False
    saw_environment = False
    rendered: list[str] = []

    for line in lines:
        if line.startswith("DISCORD_TOKEN="):
            rendered.append("DISCORD_TOKEN=")
            saw_token = True
        elif line.startswith("ENVIRONMENT="):
            rendered.append("ENVIRONMENT=production")
            saw_environment = True
        else:
            rendered.append(line)

    if not saw_token:
        rendered.insert(0, "DISCORD_TOKEN=")
    if not saw_environment:
        rendered.append("ENVIRONMENT=production")

    return "\n".join(rendered) + "\n"


def runtime_command(repo_root: Path) -> list[str]:
    return [
        str(CAFFEINATE),
        "-s",
        str(repo_root / ".venv" / "bin" / "python"),
        str(repo_root / "main.py"),
    ]


def build_launch_agent(repo_root: Path, home: Path) -> dict[str, object]:
    logs = home / "Library" / "Logs" / "marwie-server-bot"
    return {
        "Label": LABEL,
        "ProgramArguments": [
            str(repo_root / ".venv" / "bin" / "python"),
            str(repo_root / "scripts" / "local_hosting.py"),
            "run",
        ],
        "RunAtLoad": True,
        "KeepAlive": True,
        "ThrottleInterval": 15,
        "WorkingDirectory": str(repo_root),
        "StandardOutPath": str(logs / "stdout.log"),
        "StandardErrorPath": str(logs / "stderr.log"),
        "ProcessType": "Background",
    }


def load_runtime_environment(
    env_path: Path,
    base_env: Mapping[str, str],
) -> dict[str, str]:
    if not env_path.is_file():
        raise RuntimeError(f"production environment file is missing: {env_path}")

    parsed = dotenv_values(env_path)
    token = (parsed.get("DISCORD_TOKEN") or "").strip()
    if not token:
        raise RuntimeError("DISCORD_TOKEN is unset")

    environment = (parsed.get("ENVIRONMENT") or "").strip()
    if environment != "production":
        raise RuntimeError("ENVIRONMENT must be production")

    merged = dict(base_env)
    for key, value in parsed.items():
        if value is not None:
            merged[key] = value
    return merged


def _runtime_paths(home: Path) -> tuple[Path, Path, Path]:
    config_dir = home / ".config" / "marwie-server-bot"
    env_path = config_dir / "production.env"
    plist_path = home / "Library" / "LaunchAgents" / f"{LABEL}.plist"
    return config_dir, env_path, plist_path


def install_runtime(repo_root: Path, home: Path) -> tuple[Path, Path]:
    example_path = repo_root / ".env.example"
    python_path = repo_root / ".venv" / "bin" / "python"
    if not example_path.is_file():
        raise RuntimeError(f"missing environment template: {example_path}")
    if not python_path.is_file():
        raise RuntimeError(f"missing Python virtual environment: {python_path}")
    if not CAFFEINATE.is_file():
        raise RuntimeError(f"missing caffeinate executable: {CAFFEINATE}")

    config_dir, env_path, plist_path = _runtime_paths(home)
    log_dir = home / "Library" / "Logs" / "marwie-server-bot"

    config_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    config_dir.chmod(0o700)
    log_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    log_dir.chmod(0o700)
    plist_path.parent.mkdir(parents=True, exist_ok=True)

    if not env_path.exists():
        env_path.write_text(production_env_template(example_path.read_text()))
    env_path.chmod(0o600)

    with plist_path.open("wb") as handle:
        plistlib.dump(build_launch_agent(repo_root, home), handle, sort_keys=True)
    plist_path.chmod(0o644)

    return env_path, plist_path


def check_runtime(repo_root: Path, home: Path) -> list[str]:
    errors: list[str] = []
    python_path = repo_root / ".venv" / "bin" / "python"
    _, env_path, plist_path = _runtime_paths(home)

    if not python_path.is_file():
        errors.append(f"Python virtual environment is missing: {python_path}")
    if not CAFFEINATE.is_file():
        errors.append(f"caffeinate is missing: {CAFFEINATE}")

    if not env_path.is_file():
        errors.append(f"production environment file is missing: {env_path}")
    else:
        mode = stat.S_IMODE(env_path.stat().st_mode)
        if mode != 0o600:
            errors.append("production environment file permissions must be 0600")
        try:
            load_runtime_environment(env_path, {})
        except RuntimeError as exc:
            errors.append(str(exc))

    if not plist_path.is_file():
        errors.append(f"LaunchAgent plist is missing: {plist_path}")
    else:
        try:
            with plist_path.open("rb") as handle:
                actual = plistlib.load(handle)
        except (OSError, plistlib.InvalidFileException) as exc:
            errors.append(f"LaunchAgent plist is invalid: {exc}")
        else:
            if actual != build_launch_agent(repo_root, home):
                errors.append("LaunchAgent plist does not match the current repository")

    return errors


def run_runtime(repo_root: Path, home: Path) -> None:
    _, env_path, _ = _runtime_paths(home)
    environment = load_runtime_environment(env_path, os.environ)
    command = runtime_command(repo_root)
    os.chdir(repo_root)
    os.execve(command[0], command, environment)


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Manage local macOS hosting for Rob-bot.")
    parser.add_argument("action", choices=("install", "check", "run"))
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    repo_root = Path(__file__).resolve().parent.parent
    home = Path.home()

    if args.action == "install":
        try:
            env_path, plist_path = install_runtime(repo_root, home)
        except RuntimeError as exc:
            print(f"local hosting install failed: {exc}", file=sys.stderr)
            return 1
        print(f"production environment: {env_path}")
        print(f"LaunchAgent plist: {plist_path}")
        print("LaunchAgent activation is intentionally separate from this command.")
        return 0

    if args.action == "check":
        errors = check_runtime(repo_root, home)
        if errors:
            for error in errors:
                print(f"ERROR: {error}", file=sys.stderr)
            return 1
        print("local hosting configuration: OK")
        return 0

    try:
        run_runtime(repo_root, home)
    except RuntimeError as exc:
        print(f"local hosting start failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
