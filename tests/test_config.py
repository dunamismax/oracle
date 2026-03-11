"""Unit tests for configuration helpers."""

from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.config import load_config, load_env_file


class ConfigTests(unittest.TestCase):
    def test_load_env_file_sets_missing_values_only(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            env_file = Path(tmpdir) / ".env"
            env_file.write_text(
                "MTG_DISCORD_TOKEN=file-token\nMTG_LOG_LEVEL=DEBUG\n",
                encoding="utf-8",
            )

            with patch.dict(
                os.environ,
                {"MTG_DISCORD_TOKEN": "existing-token"},
                clear=False,
            ):
                load_env_file(env_file)

                self.assertEqual(os.environ["MTG_DISCORD_TOKEN"], "existing-token")
                self.assertEqual(os.environ["MTG_LOG_LEVEL"], "DEBUG")

    def test_load_config_reads_runtime_values(self) -> None:
        with patch.dict(
            os.environ,
            {
                "MTG_DISCORD_TOKEN": "token",
                "MTG_COMMAND_PREFIX": "?",
                "MTG_LOG_LEVEL": "WARNING",
                "MTG_JSON_LOGGING": "true",
                "MTG_COMMAND_COOLDOWN": "1.5",
            },
            clear=False,
        ):
            cfg = load_config()

            self.assertEqual(cfg.discord_token, "token")
            self.assertEqual(cfg.command_prefix, "?")
            self.assertEqual(cfg.log_level, "warning")
            self.assertTrue(cfg.json_logging)
            self.assertEqual(cfg.command_cooldown, 1.5)

    def test_validate_config_requires_discord_token(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            cfg = load_config()

            with self.assertRaisesRegex(ValueError, "MTG_DISCORD_TOKEN is required"):
                cfg.validate_config()
