// Registers slash commands with Discord. Run this once after adding or
// changing a command, and again any time a command's options change.
//
//   npm run deploy-commands
//
// With GUILD_ID set in .env, commands register instantly to that one
// server — the fast loop for development. Without it, they register
// globally, which can take up to an hour to show up everywhere, but
// works in any server the bot is invited to.

const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const config = require('./config');

const commands = [];
const commandsDir = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsDir).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsDir, file));
  if (command.data) commands.push(command.data.toJSON());
}

const rest = new REST().setToken(config.token);

(async () => {
  try {
    const route = config.guildId
      ? Routes.applicationGuildCommands(config.clientId, config.guildId)
      : Routes.applicationCommands(config.clientId);

    console.log(
      `Registering ${commands.length} command(s) ${config.guildId ? `to guild ${config.guildId}` : 'globally'}...`
    );
    await rest.put(route, { body: commands });
    console.log('Done.');
  } catch (error) {
    console.error('Failed to register commands:', error);
    process.exitCode = 1;
  }
})();
