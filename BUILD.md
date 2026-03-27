# BUILD

This file tracks the development phases for the MTG Card Bot, a Python Discord bot that performs
Magic: The Gathering card lookups against the Scryfall API.

## Stack

| Concern | Choice |
| --- | --- |
| Language | Python 3.13 |
| Package manager | uv |
| Formatter | ruff format |
| Linter | ruff check |
| Type checker | Pyright |
| Tests | pytest + pytest-asyncio |
| HTTP client | httpx (async) |
| Discord client | discord.py |
| Logging | stdlib logging with structured wrapper |
| Config | environment variables via os.getenv |

## Phase 1: Bootstrap

- [x] Initialize project with pyproject.toml and uv
- [x] Pin Python 3.13 via uv python
- [x] Add runtime dependencies: discord.py, httpx
- [x] Add dev dependencies: ruff, pyright, pytest, pytest-asyncio, pytest-cov, pre-commit
- [x] Configure ruff (line length, import sorting, bugbear/pyupgrade basics)
- [x] Configure Pyright as the primary type checker
- [x] Configure pytest (asyncio_mode, testpaths, coverage reporting)
- [x] Add package entrypoint via project.scripts
- [x] Write LICENSE (Apache 2.0)
- [x] Write README.md with quick start and configuration table

## Phase 2: Core API Integration

- [x] Implement ScryfallClient with rate limiting (100 ms between requests)
- [x] Add Card and CardFace data models parsed from Scryfall JSON
- [x] Add SearchResult model for paginated search responses
- [x] Implement get_card_by_name (fuzzy), get_card_by_exact_name, get_random_card
- [x] Implement search_cards and search_card_first with order/dir parameters
- [x] Implement get_card_rulings
- [x] Map ScryfallError HTTP status codes to MTGError / ErrorType
- [x] Add MTGConfig with all MTG_* environment variables
- [x] Add load_env_file helper for .env support
- [x] Add structured logging wrapper (with_component, Logger)

## Phase 3: Discord Bot and Features

- [x] Implement MTGCardBot extending discord.Client
- [x] Add message content intent and on_message dispatch
- [x] Support command prefix (default: !) and bracket syntax ([[card name]])
- [x] Implement card lookup command with filter and sort parameter extraction
- [x] Implement random card command with optional Scryfall filter query
- [x] Implement rules lookup command using get_card_rulings
- [x] Implement help command with embed showing all commands and examples
- [x] Implement multi-card lookup via semicolon-separated queries
- [x] Send card grid with image attachments capped at 4 per message
- [x] Add per-user rate limiting via _user_rate_limits dict
- [x] Add duplicate suppression via _recent_commands and _processed_message_ids
- [x] Background cleanup task for duplicate suppression state
- [x] Graceful shutdown with SIGTERM/SIGINT handling and asyncio.Event
- [x] Implement manage_bot.py CLI manager (start, stop, restart, status, logs, kill)
- [x] Wire MTG_COMMAND_COOLDOWN into per-user rate limiter
- [x] Fix filtered random to use /cards/random?q=... endpoint
- [x] Fix multi-card image attachments to skip oversized PNG format

## Phase 4: Tech Stack Alignment

Modernization checkpoint completed on 2026-03-27. This phase aligns the repo with the current
Python stack while keeping bot behavior unchanged.

- [x] Remove unused runtime dependencies: `pydantic-settings`, `structlog`, `aiosqlite`, and
      `pillow`
- [x] Move project metadata and tooling configuration into `pyproject.toml` as the single source
      of truth
- [x] Replace setuptools build metadata with a lightweight hatchling backend
- [x] Switch the primary type checker from mypy to Pyright
- [x] Align Python version to 3.13 across `.python-version`, project metadata, Ruff, and Pyright
- [x] Right-size Ruff to a passing, maintainable rule set for this repo instead of a noisy
      aspirational config
- [x] Add `pytest-cov` coverage reporting and a minimal `tests/` suite covering config,
      MTGError construction, and mocked Scryfall client behavior
- [x] Add `.pre-commit-config.yaml` with Ruff and Pyright hooks
- [x] Update `.env.example` and `README.md` to match the new development workflow
- [x] Keep future persistence guidance conservative: no database dependency until the bot has a
      concrete stateful feature that needs one
