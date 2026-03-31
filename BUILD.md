# BUILD.md

## Purpose

This file is the living execution manual for the current MTG Card Bot evolution work.

Future agents are expected to:

- work through this file in order
- keep it current as reality changes
- add, remove, or rewrite steps when the plan changes
- check boxes as phases, tasks, and acceptance criteria are actually completed
- leave aspirational or not-yet-done work unchecked

Do not treat this file as marketing copy. Treat it as the operational truth for active build work.

When the active build or evolution work is complete, fold any durable current-state guidance back into `README.md` or other stable docs and remove this file.

## Executive decision

**MTG Card Bot should remain a Python-first Discord bot.**

A literal rewrite of this repo into Stephen's default full-stack web lane would be the wrong move.

Stephen's current preferred web stack is:

- Bun
- TypeScript
- Astro
- Vue
- Elysia
- Zod
- PostgreSQL
- Docker Compose
- Caddy

That stack is the right default for web-first products with meaningful browser UX, backend contracts, auth, persistence, and self-hosted application runtime needs.

This repo is not that.

This repo is currently:

- a focused Python 3.13 Discord bot
- a thin integration with Discord and Scryfall
- largely stateless outside runtime config and in-memory behavior
- a good fit for Stephen's Python lane, not a forced Bun monorepo rewrite

## Portfolio and stack alignment call

This repo still fits Stephen's current portfolio direction, just not by pretending to be a web app.

The honest positioning is:

- **Primary lane:** Python automation and API/integration work
- **Primary surface:** Discord bot interaction
- **Primary value:** fast card lookup, pricing, legality, rulings, and dependable message handling
- **Primary architectural goal:** keep the bot sharp, reliable, testable, and easy to self-host

If the MTG project eventually grows into a real browser-first product with accounts, deck history, collection state, persistent user preferences, admin tooling, or broader game-night workflows, then a separate or expanded web product may earn Astro + Vue on the frontend.

If that happens, the likely honest shape is:

- keep the Discord bot as a bot and integration surface
- keep Python for backend logic if that remains the best fit
- add Astro + Vue only for a genuinely useful web surface
- add PostgreSQL only when the product needs durable relational state
- use Docker Compose and Caddy only when the deployed runtime actually earns them

Do not rewrite this repo into Bun + Elysia just to match the portfolio stack document. That would be theater.

## Current repo truth

Current observed repo truth:

- Language: Python 3.13
- Package and environment management: `uv`
- Discord runtime: `discord.py`
- HTTP client: `httpx`
- Quality gates: Ruff, Pyright, pytest
- Packaging: `pyproject.toml` + Hatchling
- CI: GitHub Actions running lint, format check, type check, and tests
- Main behaviors:
  - bracket lookup like `[[Lightning Bolt]]`
  - command lookup with fuzzy matching
  - live pricing, legality, and rulings via Scryfall
  - random card queries with Scryfall filters
  - multi-card queries in one message
  - structured logging and graceful shutdown

This is already coherent.

## What should stay as-is

These are the current-fit choices unless a real product requirement proves otherwise:

- **Python** as the primary runtime
- **uv** as package and environment manager
- **discord.py** as the Discord client layer
- **httpx** for async HTTP access to Scryfall
- **Ruff + Pyright + pytest** as the verification baseline
- **single-process bot architecture** unless real complexity forces a split
- **Scryfall-first data lookup model** rather than inventing local shadow data too early

## What can align with Stephen's newer defaults without forcing a rewrite

These are valid alignment opportunities if the repo earns them:

- **PostgreSQL** if the bot gains durable user preferences, caching, query history, guild-specific settings, rate-limit state, or analytics worth keeping
- **Docker Compose** if local or self-hosted runtime adds multiple real services such as Postgres or a worker
- **Caddy** only if a real HTTP surface exists and needs clean self-hosted ingress
- **Astro + Vue** only if a meaningful operator, admin, or public web surface appears
- **shared contracts** only if a web or API surface actually needs them

## What should not happen without a major product change

Do not do these by default:

- **Do not rewrite the bot into a Bun full-stack app**
- **Do not replace Python with TypeScript just for consistency theater**
- **Do not add PostgreSQL before there is real durable state to justify it**
- **Do not add Docker Compose and Caddy to a single-process bot with no HTTP surface**
- **Do not create a browser dashboard because dashboards feel more portfolio-friendly**
- **Do not split this into frontend and backend repos unless the product shape radically changes**

## Evolution principles

1. **Keep the repo honest.** Stable docs describe shipped reality. This file tracks active evolution only.
2. **Prefer Python improvements over stack churn.** Better reliability beats trend alignment.
3. **Add infrastructure only when it removes pain.** No deployment cosplay.
4. **Treat Discord behavior as the product.** The bot experience matters more than speculative side surfaces.
5. **Preserve fast local verification.** `uv run` quality gates stay cheap and obvious.
6. **If a web surface becomes real, add it deliberately.** Do not let "maybe someday" distort the current repo.
7. **If the project outgrows bot-only shape, reassess whether the new product belongs in this repo at all.**

## Desired target state

The likely best target state for this repo is not a rewritten web app.

The likely best target state is:

- a polished Python Discord bot
- clear config and operator docs
- dependable runtime behavior
- strong local verification and CI
- optional persistent storage only if user-facing features truly need it
- optional deployment packaging only if Stephen wants this to be a regularly self-hosted service

A web-facing MTG product, if it becomes substantial, may deserve its own architecture decision later.

## Phase plan

## Phase 0 - Freeze current truth and remove ambiguity

**Goal:** make the repo's actual shape and intended direction explicit so future work stops guessing.

### Work

- [ ] Confirm `README.md` accurately describes the current Python bot runtime and command surface.
- [ ] Confirm `CONTRIBUTING.md` matches the real local verification flow.
- [ ] Confirm this `BUILD.md` states clearly that the repo is Python-first and not a forced web-stack rewrite.
- [ ] Inventory any gaps between documented behavior and actual bot commands, config, or runtime expectations.
- [ ] Decide whether there is any currently planned feature that would truly require durable storage or a web surface.

### Acceptance criteria

- [ ] Stable docs describe the shipped repo truth without pretending a rewrite already happened.
- [ ] Future agents can tell which changes fit this repo and which would be architectural overreach.
- [ ] There is a written decision about whether the near-term roadmap is still bot-only.

## Phase 1 - Tighten the Python bot baseline

**Goal:** make the existing Python bot lane cleaner, safer, and more maintainable.

### Work

- [ ] Audit command parsing, multi-query handling, and bracket lookup behavior for edge cases.
- [ ] Audit Scryfall error handling, timeout handling, and user-facing failure responses.
- [ ] Review logging for useful operational context without noisy duplication.
- [ ] Review cooldown, duplicate suppression, and shutdown behavior for correctness.
- [ ] Identify any missing tests around the highest-value command and Scryfall integration paths.
- [ ] Normalize developer commands so the expected `uv run` workflow is obvious and consistent.

### Acceptance criteria

- [ ] The bot's highest-value lookup flows are covered by focused tests.
- [ ] Failure modes from Discord or Scryfall are handled predictably.
- [ ] Local verification remains fast and easy to run.

## Phase 2 - Decide whether persistent state is actually earned

**Goal:** avoid premature database work while leaving a clean path if the product needs it.

### Work

- [ ] Inventory current features that are stateless versus features that would benefit from durable state.
- [ ] Decide whether the bot needs guild-specific settings, user preferences, caching, analytics, audit history, or moderation-safe logs.
- [ ] If no meaningful durable state is needed, explicitly keep the repo stateless and stop there.
- [ ] If durable state is needed, define the smallest correct PostgreSQL-backed scope first.
- [ ] If PostgreSQL is added, document the exact ownership boundary for stored data and operator expectations.

### Acceptance criteria

- [ ] The repo has an explicit decision on whether durable storage belongs here.
- [ ] PostgreSQL is only introduced if a real user or operator need justifies it.
- [ ] Any added persistence has a narrow, documented scope.

## Phase 3 - Improve operator experience only if operations become real pain

**Goal:** add runtime and deployment structure only when the bot's actual use justifies it.

### Work

- [ ] Decide whether this bot is intended for one-off local runs, regular self-hosting, or broader deployment reuse.
- [ ] If self-hosting becomes a real goal, define the simplest supported operator path.
- [ ] Consider a documented service runner path for long-lived operation.
- [ ] Consider containerization only if it clearly simplifies deployment or consistency.
- [ ] Add Docker Compose only if multiple real services exist.
- [ ] Add health or status surfaces only if there is a real operational need for them.

### Acceptance criteria

- [ ] The repo has one clearly documented operator path.
- [ ] Added operational tooling reduces real friction instead of introducing ceremony.
- [ ] No multi-service runtime exists unless the product truly needs one.

## Phase 4 - Evaluate optional adjacent surfaces honestly

**Goal:** only add non-Discord surfaces if they create real product value.

### Work

- [ ] Decide whether an operator/admin web surface would materially improve maintainability or user value.
- [ ] Decide whether a public web surface would duplicate existing bot behavior or genuinely expand the product.
- [ ] If a web surface is justified, define whether it belongs in this repo or a sibling repo.
- [ ] If a web surface is justified, use Stephen's current web frontend defaults honestly:
  - [ ] Astro for page ownership
  - [ ] Vue only for earned interactivity
  - [ ] Plain CSS first
- [ ] If backend APIs are needed for that surface, decide whether Python remains the right backend lane or whether a separate service earns a different runtime.
- [ ] Keep the Discord bot as a first-class integration surface rather than a legacy leftover.

### Acceptance criteria

- [ ] No web surface is added without a clear product reason.
- [ ] Any web addition complements the bot instead of pretending the bot was the wrong product all along.
- [ ] Stack decisions for any added surface are documented with fit boundaries.

## Phase 5 - Finalize current-truth docs and remove this file when done

**Goal:** end with stable docs that describe the shipped reality, not an eternal phase tracker.

### Work

- [ ] Fold any durable outcomes from this build plan into `README.md`, `CONTRIBUTING.md`, or other stable docs.
- [ ] Remove obsolete roadmap language once decisions are implemented.
- [ ] Delete `BUILD.md` when the active build phase is genuinely complete.

### Acceptance criteria

- [ ] Stable docs reflect only current truth.
- [ ] This file no longer exists once it stops serving an active build purpose.
- [ ] Future maintenance does not depend on stale phase-tracker language.

## Verification contract

Until the architecture materially changes, the verification contract for this repo should stay Python-native:

```bash
uv sync
uv run ruff check .
uv run ruff format --check .
uv run pyright
uv run pytest
```

If persistent storage, HTTP surfaces, or deployment packaging are later added, extend verification only as needed. Do not replace a simple verification path with a more fashionable one.

## Reassessment triggers

Reassess the architecture only if one or more of these become true:

- the bot needs durable relational state that is central to product behavior
- the project gains a real admin or public web surface
- the product expands beyond Discord into a broader MTG workflow tool
- operational complexity grows beyond a clean single-process bot
- the repo starts serving a different product than "Discord bot for fast card lookup"

If none of those are true, keep the repo in the Python lane and improve the bot.

## Final call

This repo should evolve toward a better version of itself, not toward a different category of product.

That means:

- keep **Python** as the core runtime
- keep **Discord** as the core surface
- strengthen verification, reliability, and operator clarity
- add **PostgreSQL**, **Docker Compose**, **Caddy**, or **Astro + Vue** only if the product shape actually earns them

Anything else is architecture cosplay.
