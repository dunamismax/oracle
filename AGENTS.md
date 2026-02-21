# AGENTS.md

> Runtime operations source of truth for this repository.
> This file defines how scry should operate in `mtg-card-bot`.

---

## First Rule

Read `SOUL.md` first, then this file, then inspect `README.md` and touched bot modules before editing.

---

## Repo Scope

- Repo: `mtg-card-bot`
- Purpose: Discord bot for MTG card/rules lookup via Scryfall.
- Runtime shape:
  - Bot behavior in `mtg_card_bot/bot.py`
  - Scryfall integration in `mtg_card_bot/scryfall.py`
  - Runtime config in `mtg_card_bot/config.py`
  - Process control helper in `manage_bot.py`

---

## Owner

- Name: Stephen
- Alias: `dunamismax`
- Home: `/Users/sawyer`
- Projects root: `/Users/sawyer/github`

---

## Stack Contract (Strict)

Use current repo stack unless Stephen explicitly approves changes:

- Runtime: **Python 3.12+**
- Package/dependency manager: **uv**
- Discord client: **discord.py**
- External API: **Scryfall**
- HTTP client: **httpx**
- Config/env loading: **pydantic-settings**
- Logging: **structlog**
- Local storage/helpers: **aiosqlite**, **Pillow**
- Quality tooling: **Ruff**, **MyPy**

---

## Operating Contract

- Keep token and secret handling strict; never commit real credentials.
- Preserve API pacing/cooldown behavior to avoid spam and rate-limit issues.
- Keep bot command behavior predictable and user-facing messages clear.
- Prefer small, reversible changes over wide command-surface rewrites.
- Keep README/ops docs aligned with actual command behavior.

---

## Workflow

`Wake -> Explore -> Plan -> Code -> Verify -> Report`

- **Explore**: read relevant command and integration paths first.
- **Plan**: smallest safe change for the requested behavior.
- **Code**: preserve existing async/error-handling conventions.
- **Verify**: run concrete checks and report outcomes.
- **Report**: summarize behavior changes and operational impact.

---

## Command Policy

- Use `uv` as canonical command runner for this repo.
- Do not introduce unrelated toolchains.
- Avoid destructive operations without explicit approval.

### Canonical commands

```bash
# setup
uv sync

# local bot control
uv run python manage_bot.py start
uv run python manage_bot.py status
uv run python manage_bot.py stop

# quality gates
uv run ruff format .
uv run ruff check .
uv run mypy mtg_card_bot

# optional tests (if tests are present)
uv run pytest
```

---

## Git Remote Sync Policy

- Use `origin` as working remote.
- `origin` fetch URL:
  - `git@github.com-dunamismax:dunamismax/mtg-card-bot.git`
- `origin` push URLs:
  - `git@github.com-dunamismax:dunamismax/mtg-card-bot.git`
  - `git@codeberg.org-dunamismax:dunamismax/mtg-card-bot.git`
- `git push origin main` must publish to both.
- Never force-push `main` unless Stephen explicitly asks.

---

## Done Criteria

A task is done when all are true:

- Requested behavior is implemented.
- Relevant quality checks were run and reported.
- Secret-handling and API-usage safety are preserved.
- Diff is focused and reviewable.

---

## Living Document Protocol

- Keep current-state only.
- Update when repo tooling/workflow/contracts change.
