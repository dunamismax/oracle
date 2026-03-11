#!/usr/bin/env python3
"""Thin launcher for scryfall-discord-bot."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

from app import config

APP_NAME = "scryfall-discord-bot"
REMOVED_COMMANDS = {"stop", "restart", "logs", "kill"}


def load_local_env() -> None:
    """Load a local .env file when present."""
    env_file = Path(".env")
    if env_file.exists():
        config.load_env_file(env_file)


def validate_runtime() -> config.BotConfig:
    """Load and validate runtime configuration."""
    cfg = config.load_config()
    cfg.validate_config()
    return cfg


def build_runtime_command() -> list[str]:
    """Return the simplest available command for launching the bot."""
    if shutil.which("uv"):
        return ["uv", "run", "python", "-m", "app"]
    return [sys.executable, "-m", "app"]


def run_bot() -> int:
    """Run the bot in the foreground."""
    load_local_env()

    try:
        validate_runtime()
    except ValueError as exc:
        print(f"Configuration error: {exc}", file=sys.stderr)
        return 1

    command = build_runtime_command()
    print(f"Launching {APP_NAME} in the foreground.")
    print("This repo does not supervise background processes.")
    print("Use systemd, Docker, or another external supervisor for restarts.")
    return subprocess.run(command, check=False).returncode


def check_runtime() -> int:
    """Validate config and print the launch command."""
    load_local_env()

    try:
        cfg = validate_runtime()
    except ValueError as exc:
        print(f"Configuration error: {exc}", file=sys.stderr)
        return 1

    print("Configuration looks valid.")
    print(f"Command prefix: {cfg.command_prefix}")
    print(f"Log level: {cfg.log_level}")
    print(f"Launch command: {' '.join(build_runtime_command())}")
    print("No built-in stop/restart/status manager is shipped in this repo.")
    return 0


def build_parser() -> argparse.ArgumentParser:
    """Build the CLI parser."""
    parser = argparse.ArgumentParser(
        description="Run or validate scryfall-discord-bot."
    )
    parser.add_argument(
        "command",
        nargs="?",
        default="run",
        help="run, start, check, or status",
    )
    return parser


def main() -> int:
    """CLI entry point."""
    args = build_parser().parse_args()
    command = args.command.lower()

    if command in {"run", "start"}:
        return run_bot()

    if command in {"check", "status"}:
        return check_runtime()

    if command in REMOVED_COMMANDS:
        print(f"`{command}` was removed from manage_bot.py.", file=sys.stderr)
        print(
            "Run the bot in the foreground and let a real supervisor manage it.",
            file=sys.stderr,
        )
        return 2

    print(f"Unknown command: {command}", file=sys.stderr)
    print("Available commands: run, start, check, status", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
