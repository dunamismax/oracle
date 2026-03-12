# scryfall-discord-bot

Discord bot for fast Magic: The Gathering card lookups using the [Scryfall API](https://scryfall.com/docs/api).

## Scope

- Prefix lookups like `!lightning bolt`
- Bracket lookups like `[[Lightning Bolt]]`
- `rules <card name>` for rulings
- `random` with optional Scryfall filters
- Semicolon-separated multi-card lookups
- Rich embeds with imagery, prices, legality, and set info

This rewrite uses only the stack pieces the bot actually needs:

- Bun for runtime and package management
- TypeScript for the application code
- Zod for config validation and API payload parsing
- Biome for linting and formatting
- Vitest for tests

TanStack Start/Router/Query, PostgreSQL, Drizzle, Better Auth, and OpenTelemetry are intentionally not included because this repo is a Discord bot process with no web UI, auth flow, or persistence layer.

## Run It

Requirements:

- [Bun](https://bun.sh/)
- A Discord bot token with Message Content intent enabled

Setup:

```bash
cp .env.example .env
# set MTG_DISCORD_TOKEN in .env
bun install
bun run start
```

Optional wrapper:

```bash
bun run manage-bot.ts run
```

`manage-bot.ts` only validates config and launches the bot in the foreground. If you need restarts or backgrounding, use systemd, Docker, a container platform, or another real supervisor.

## Checks

```bash
bun run test
bun run typecheck
bun run lint
```

## Layout

```text
src/
  index.ts             # bot entrypoint
  bot.ts               # Discord command and event handling
  scryfall.ts          # Scryfall API integration
  config.ts            # environment loading and validation
manage-bot.ts          # thin foreground launcher
tests/                 # Vitest coverage for stable utility code
```

## License

[MIT](LICENSE)
