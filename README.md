# Farm Bot

An original farming-sim Discord bot: plant and harvest crops, collect
rarity-tiered tools, and grow your own garden — played entirely through
slash commands. No external services required for development; it uses a
local SQLite file for storage.

## Commands

- `/garden` — view your plots and what's growing
- `/plant crop:<name> [plot:<n>]` — plant a seed you own
- `/harvest [plot:<n>]` — harvest everything ready (or one plot)
- `/inventory` — see your coins, seeds, crops, and tools
- `/shop` — see seed and tool prices
- `/buy seed crop:<name> [amount:<n>]` — buy seeds
- `/buy tool type:<name> rarity:<tier>` — buy a tool
- `/equip type:<name> rarity:<tier>` — equip an owned tool
- `/expand` — spend coins to add another garden plot

Tools also have a small chance to drop directly from harvesting.

## Setup

1. **Create a Discord application.**
   Go to <https://discord.com/developers/applications>, click "New
   Application", and give it a name.

2. **Create the bot user.**
   Open the "Bot" tab, click "Reset Token" to generate a token, and copy
   it somewhere safe — you'll only see it once. Under "Privileged Gateway
   Intents", nothing extra needs to be enabled for this bot.

3. **Get your application (client) ID.**
   Found on the "General Information" tab, labeled "Application ID".

4. **Invite the bot to a server.**
   Under "OAuth2" → "URL Generator", check the `bot` and
   `applications.commands` scopes, then under Bot Permissions check
   "Send Messages" and "Use Slash Commands". Open the generated URL and
   add the bot to a server you control.

5. **Configure the project.**
   ```bash
   cp .env.example .env
   ```
   Fill in `DISCORD_TOKEN` and `CLIENT_ID` from steps 2–3. For fast
   local testing, also set `GUILD_ID` to your test server's ID (enable
   Developer Mode in Discord's settings, then right-click the server
   icon → "Copy Server ID").

6. **Install dependencies.**
   ```bash
   npm install
   ```

7. **Register the slash commands.**
   ```bash
   npm run deploy-commands
   ```
   Re-run this any time you add a command or change its options.

8. **Run the bot.**
   ```bash
   npm start
   ```
   You should see `Logged in as <bot name>. 8 commands loaded.` in the
   console. Try `/garden` in your test server.

## How it's built

- **discord.js v14** for the bot itself (slash commands, embeds).
- **better-sqlite3** for storage — a single `farm.sqlite` file, created
  automatically on first run. No separate database server needed.
- Crop growth is checked lazily: a plot stores when it was planted, and
  `/garden` or `/harvest` compute whether it's ready from the current
  time. There's no background job ticking timers, which keeps this MVP
  simple to run anywhere. The build plan's production architecture
  (Postgres + Redis-backed job queue) is a later swap, not a day-one
  requirement.
- Game data (crops, tool types, rarity bonuses) lives in `src/data/` as
  plain objects — tune prices, grow times, and bonuses there without
  touching command logic.

## What's not here yet

This is the core loop only. Not implemented: subscription monetization
(the plan's tiers need a verified Discord app in the Developer
Monetization Program, which is a dashboard setup step, not code — see
the "Billing" row in the plan doc's Technical Architecture section for
where it would hook in), trading between players, and seasonal/limited
events. All straightforward to layer onto this foundation.
