<p align="center">
  Discord bot for fast Magic: The Gathering card lookups powered by Scryfall.
</p>

# MTG Card Bot

MTG Card Bot is a Python Discord bot for card search, random pulls, and rules lookup. It is built for quick in-chat retrieval of MTG card details with API-aware throttling and operational management commands.

## Trust Signals

![Python](https://img.shields.io/badge/Python-3.12%2B-blue)
![Package Manager](https://img.shields.io/badge/Package_Manager-uv-informational)
![Data Source](https://img.shields.io/badge/Data-Scryfall-success)
![License](https://img.shields.io/badge/License-MIT-brightgreen)

## Quick Start

### Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) package manager
- Discord bot token with Message Content intent enabled

### Run

```bash
git clone https://github.com/dunamismax/mtg-card-bot.git
cd mtg-card-bot
cp .env.example .env
# set MTG_DISCORD_TOKEN in .env
uv sync
uv run python manage_bot.py start
```

Expected result:

- Startup logs stream in your terminal.
- Bot appears online in your Discord server.

## Features

- Card lookup via prefix command or bracket syntax (`[[Card Name]]`).
- Random card retrieval with optional Scryfall query filters.
- Rules lookup via `rules <card name>`.
- Multi-card lookup with semicolon-separated queries.
- Duplicate command suppression and per-user cooldown handling.
- Rich card embeds with prices, legality, and imagery.

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Runtime | Python 3.12+ | Bot runtime |
| Discord Client | [`discord.py`](https://discordpy.readthedocs.io/) | Discord event handling |
| Data Source | [Scryfall API](https://scryfall.com/docs/api) | Card, rules, and random data |
| HTTP Client | [`httpx`](https://www.python-httpx.org/) | Async API/image requests |
| Config | `.env` + `mtg_card_bot/config.py` | Runtime config and secret loading |
| Tooling | `uv`, Ruff, MyPy | Dependency and quality workflows |

## Project Structure

```sh
mtg-card-bot/
├── mtg_card_bot/
│   ├── __main__.py                 # Bot entrypoint
│   ├── bot.py                      # Discord command/event handling
│   ├── scryfall.py                 # Scryfall API integration
│   ├── config.py                   # Environment config and validation
│   ├── logging.py                  # Structured logging helpers
│   └── errors.py                   # Error types and classification
├── manage_bot.py                   # Start/stop/status/log process manager
├── .env.example                    # Required and optional environment variables
├── pyproject.toml                  # Dependencies and tooling configuration
├── uv.lock                         # Locked dependency graph
└── README.md
```

## Development Workflow and Common Commands

### Setup

```bash
uv sync
```

### Run

```bash
uv run python manage_bot.py start
python3 manage_bot.py status
python3 manage_bot.py stop
```

### Test

No automated test suite is currently committed in this repository.

### Lint and Format

```bash
uv run ruff format .
uv run ruff check .
uv run mypy mtg_card_bot
```

### Build

No separate build step is required for local bot execution.

### Deploy (Generic Service Flow)

```bash
uv run python manage_bot.py start
```

Run this command under your host service manager (`systemd`, Docker, PM2-compatible wrapper, etc.) for production uptime.

Command verification notes for this README rewrite:

- Verified in this environment: `python3 --version`, `python3 manage_bot.py status`.
- Not executed in this rewrite: `uv sync` and other `uv` commands (uv not installed in this environment), bot start flow with a real Discord token, Ruff/MyPy commands.

## Deployment and Operations

This repository does not include infrastructure manifests. Deploy as a long-running Python process with environment variables provided by your host.

- Required secret: `MTG_DISCORD_TOKEN`.
- Primary operational command: `python3 manage_bot.py status`.
- Use external process supervision for restart and uptime guarantees.

## Security and Reliability Notes

- Never commit real Discord bot tokens; keep secrets in `.env` or host-managed env vars.
- API interactions use explicit HTTP timeouts to avoid hanging requests.
- Scryfall requests are paced to respect API usage limits.
- Duplicate-command suppression and cooldowns reduce accidental spam processing.

## Documentation

| Path | Purpose |
|---|---|
| [pyproject.toml](pyproject.toml) | Dependency and tooling configuration |
| [manage_bot.py](manage_bot.py) | Runtime process management commands |
| [mtg_card_bot/bot.py](mtg_card_bot/bot.py) | Core command and message behavior |
| [mtg_card_bot/scryfall.py](mtg_card_bot/scryfall.py) | API integration and request pacing |
| [mtg_card_bot/config.py](mtg_card_bot/config.py) | Environment variable parsing and defaults |

## Contributing

Open a pull request with reproducible command examples, expected behavior, and any relevant logs for review.

## License

Licensed under the [MIT License](LICENSE).
