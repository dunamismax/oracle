# scryfall-discord-bot

Discord bot for fast Magic: The Gathering card lookups using the [Scryfall API](https://scryfall.com/docs/api).

## Scope

- Prefix lookups like `!lightning bolt`
- Bracket lookups like `[[Lightning Bolt]]`
- `rules <card name>` for rulings
- `random` with optional Scryfall filters
- Semicolon-separated multi-card lookups
- Rich embeds with imagery, prices, legality, and set info

This repo does not ship a process manager, dashboard, or storage layer. It is a Discord bot process plus a thin local launcher.

## Run It

Requirements:

- Python 3.12+
- [uv](https://docs.astral.sh/uv/)
- A Discord bot token with Message Content intent enabled

Setup:

```bash
cp .env.example .env
# set MTG_DISCORD_TOKEN in .env
uv sync
uv run python -m app
```

Optional wrapper:

```bash
uv run python manage_bot.py run
```

`manage_bot.py` only validates config and launches the bot in the foreground. If you need restarts or backgrounding, use systemd, Docker, a container platform, or another real supervisor.

## Checks

```bash
python3 -m unittest discover -s tests -v
python3 -m compileall manage_bot.py app tests
```

Static checks are configured in `pyproject.toml`, but they are optional local tooling, not part of the runtime path.

## Layout

```text
app/                   # application package
  __main__.py          # bot entrypoint
  bot.py               # Discord command and event handling
  scryfall.py          # Scryfall API integration
  config.py            # environment loading and validation
manage_bot.py          # thin foreground launcher
tests/                 # stdlib unit tests for stable utility code
```

## License

[MIT](LICENSE)
