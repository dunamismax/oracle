"""Configuration helpers for scryfall-discord-bot."""

import os
from pathlib import Path


def get_bool(key: str, default: bool = False) -> bool:
    """Get boolean environment variable with default."""
    value = os.getenv(key)
    if value is None:
        return default
    return value.lower() in ("true", "1", "yes", "on")


def get_float(key: str, default: float = 0.0) -> float:
    """Get float environment variable with default."""
    value = os.getenv(key)
    if value is None:
        return default
    try:
        return float(value)
    except ValueError:
        return default


def load_env_file(env_file: Path) -> None:
    """Load environment variables from .env file if it exists."""
    if not env_file.exists():
        return

    with env_file.open(encoding="utf-8") as env_handle:
        for raw_line in env_handle:
            line = raw_line.strip()
            if line == "" or line.startswith("#"):
                continue

            if "=" in line:
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip()

                # Remove quotes if present
                if (value.startswith('"') and value.endswith('"')) or (
                    value.startswith("'") and value.endswith("'")
                ):
                    value = value[1:-1]

                # Only set if not already set by system environment
                if not os.getenv(key):
                    os.environ[key] = value


class BotConfig:
    """Runtime configuration for the bot."""

    def __init__(self) -> None:
        self.discord_token = os.getenv("MTG_DISCORD_TOKEN", "")
        self.command_prefix = os.getenv("MTG_COMMAND_PREFIX", "!")
        self.log_level = os.getenv(
            "MTG_LOG_LEVEL", os.getenv("LOG_LEVEL", "info")
        ).lower()
        self.json_logging = get_bool(
            "MTG_JSON_LOGGING", get_bool("JSON_LOGGING", False)
        )
        self.command_cooldown = get_float("MTG_COMMAND_COOLDOWN", 2.0)

    def validate_config(self) -> None:
        """Validate the configuration after loading."""
        if not self.discord_token:
            raise ValueError("MTG_DISCORD_TOKEN is required")

        valid_levels = {"debug", "info", "warn", "warning", "error"}
        if self.log_level not in valid_levels:
            raise ValueError(
                f"Invalid log level: {self.log_level}. Must be one of {valid_levels}"
            )


def load_config() -> BotConfig:
    """Load runtime configuration."""
    return BotConfig()
