# Farm Bot — handoff notes

This project was started in a Cowork session (cloud Claude) on 2026-10-23
and is meant to continue here in Claude Code. This file is the context
that doesn't carry over automatically — read it before making changes.

## What this is

An original farming-simulator Discord bot — not a Pokémon/Stardew Valley/
Hypixel Skyblock clone, an original IP inspired by that genre's loop
(rarity-tiered tools, crop collection, a growing personal garden). The
owner already runs a 10k-member Discord server built around a different
bot (a Pokémon-style creature-catching bot they built with a friend), and
plans to beta-test this new bot there before a public launch.

A companion planning doc exists with the full business context (monetization
tiers, go-to-market using the existing server, legal/regulatory risk
analysis around Discord's gambling-adjacent content policy and loot-box
regulation, technical architecture for a production version, and a
roadmap/budget) — ask the owner for the doc link if you need it; it isn't
included in this repo.

## Current state: working MVP, core loop only

Everything in `src/` runs today with zero external services — SQLite only.
Syntax-checked and smoke-tested (buy → plant → wait → harvest → equip,
end to end) before handoff; no known bugs, but no automated test suite
was left in the repo (the smoke test was a throwaway script, deleted
after it passed — worth writing a real one, see below).

Commands: `/garden`, `/plant`, `/harvest`, `/inventory`, `/shop`, `/buy`,
`/equip`, `/expand`. See `README.md` for what each does and full local
setup (creating the Discord app, getting a token, registering commands).

## Key design decisions (so you don't accidentally undo them)

- **Lazy time evaluation, not a job queue.** A plot stores `planted_at`;
  readiness is computed on demand in `src/game.js#plotStatus` whenever
  `/garden` or `/harvest` runs. This was a deliberate MVP simplification —
  the planning doc's production architecture assumes Postgres + a
  Redis-backed job queue for this instead. Don't add a scheduler/cron
  unless a feature actually needs push notifications ("your crop is
  ready!" DMs) — the current approach is simpler and has no bugs from
  drift or missed ticks.
- **Tool rarity is a property of the inventory stack, not a separate
  item id** (`src/db.js`, the `inventory` table's `rarity` column). "An
  Epic Hoe" and "a Common Hoe" are the same `item_id` with a different
  `rarity`. Stat bonuses are looked up by rarity alone in
  `src/data/tools.js#getBonus` — adding a new tool type means adding one
  entry to `TOOL_TYPES`, not touching the bonus logic.
- **No randomized real-money purchases, on purpose.** The monetization
  plan leans on time-skips (pay for speed) and cosmetics, never a paid
  loot box — this was a deliberate choice to sidestep both Discord's
  gambling-adjacent content policy and tightening loot-box regulation
  (Belgium/Netherlands bans, Brazil's March 2026 minors restriction).
  The in-game tool-drop-on-harvest chance in `src/commands/harvest.js`
  is free-to-play only (no currency purchases a chance at a tool) —
  keep it that way if you build out the paid tiers.
- **No names, art, or assets from Stardew Valley or Hypixel Skyblock
  anywhere**, including in code comments, command descriptions, or
  future marketing copy/App Directory listings — nominative fair use
  makes referencing them by name in casual conversation low-risk, but
  official listing copy should stick to genre language ("farming and
  crafting sim").

## Known gaps / likely next steps

- **No tests committed.** Worth adding a real test suite (the ad hoc
  smoke test covered: db CRUD, plot-ready timing math including hoe
  bonus, harvest payout/golden-roll shape, and a full buy→plant→harvest
  flow through the actual command `execute()` functions using fake
  interaction objects — a reasonable starting shape for real tests).
- **Trading between players** — not implemented. The planning doc
  calls this out as part of the core loop's depth; current inventory
  model (`src/db.js`) should support it without a schema change, just
  new commands.
- **Subscription monetization** — not implemented. Needs the Discord app
  verified through the Developer Monetization Program first (a dashboard
  step on discord.com/developers, not code); payouts are currently
  limited to teams based in the US, EU, or UK — confirm that applies
  before building the integration.
- **Seasonal/limited-time crops or events** — mentioned in the plan as
  a daily-engagement hook, not built yet.
- **Migrating off SQLite** — only worth doing when actually deploying
  somewhere persistent/multi-instance; don't do it preemptively.

## Commands you'll want

```bash
npm install
cp .env.example .env   # fill in DISCORD_TOKEN, CLIENT_ID, GUILD_ID
npm run deploy-commands
npm start
node --check src/**/*.js   # quick syntax check across the project
```
