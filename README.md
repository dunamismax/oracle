# Oracle

Discord bot for fast Magic: The Gathering card lookups powered by the [Scryfall API](https://scryfall.com/docs/api). Supports prefix commands, bracket syntax, random pulls, rules lookup, and rich embeds with prices and legality.

## Features

- **Card lookup** — prefix command or bracket syntax (`[[Card Name]]`)
- **Random card** — random pulls with optional Scryfall query filters
- **Rules lookup** — `rules <card name>` for rules text
- **Multi-card queries** — semicolon-separated lookups in one message
- **Rich embeds** — prices, legality, set info, and card imagery
- **Rate limiting** — per-user cooldowns and duplicate suppression
- **API-aware throttling** — respects Scryfall rate limits

## Prerequisites

- Python 3.12+
- [uv](https://docs.astral.sh/uv/) package manager
- Discord bot token with Message Content intent enabled

## Quick Start

```bash
git clone https://github.com/dunamismax/oracle.git
cd oracle
cp .env.example .env
# set MTG_DISCORD_TOKEN in .env
uv sync
uv run python manage_bot.py start
```

## Commands

| Command | Description |
|---|---|
| `uv sync` | Install dependencies |
| `uv run python manage_bot.py start` | Start the bot |
| `python3 manage_bot.py status` | Check bot status |
| `python3 manage_bot.py stop` | Stop the bot |
| `uv run ruff format .` | Auto-format code |
| `uv run ruff check .` | Lint check |
| `uv run mypy oracle` | Type check |

## Stack

- **Runtime**: Python 3.12+
- **Discord**: [discord.py](https://discordpy.readthedocs.io/)
- **Data**: [Scryfall API](https://scryfall.com/docs/api)
- **HTTP**: [httpx](https://www.python-httpx.org/) (async)
- **Tooling**: uv · Ruff · MyPy

## Project Structure

```
oracle/
  __main__.py           # Bot entrypoint
  bot.py                # Discord command and event handling
  scryfall.py           # Scryfall API integration
  config.py             # Environment config and validation
  logging.py            # Structured logging helpers
  errors.py             # Error types and classification
manage_bot.py           # Start/stop/status process manager
pyproject.toml          # Dependencies and tooling config
```

## Deployment

Run as a long-running process with your preferred supervisor (systemd, Docker, PM2, etc.). The only required secret is `MTG_DISCORD_TOKEN` via `.env` or host environment.

## License

[MIT](LICENSE)
