const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');
const config = require('./config');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

const commandsDir = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsDir).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsDir, file));
  if (!command.data || !command.execute) {
    console.warn(`Skipping ${file}: missing "data" or "execute" export.`);
    continue;
  }
  client.commands.set(command.data.name, command);
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}. ${client.commands.size} commands loaded.`);

  if (process.env.RENDER) {
    try {
      const channel = await readyClient.channels.fetch('1563710154065838200');
      const commit = process.env.RENDER_GIT_COMMIT || null;
      let summary = '';
      if (commit) {
        try {
          const res = await fetch(`https://api.github.com/repos/AugumS/Sprout/commits/${commit}`, {
            headers: { 'User-Agent': 'Sprout-Bot' },
          });
          const data = await res.json();
          const firstLine = data.commit?.message?.split('\n')[0];
          if (firstLine) summary = `\n> ${firstLine}`;
        } catch { /* silently skip if GitHub is unreachable */ }
      }
      await channel.send(`🌱 **Sprout updated and online!**${summary}`);
    } catch (err) {
      console.error('Failed to send deploy announcement:', err);
    }
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    const [prefix] = interaction.customId.split(':');
    if (prefix === 'shop_reroll' || prefix === 'shop_reroll_confirm' || prefix === 'shop_reroll_cancel') {
      const shop = client.commands.get('shop');
      try {
        await shop.handleButton(interaction);
      } catch (error) {
        console.error('Error handling shop reroll button:', error);
        const payload = { content: 'Something went wrong.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(payload).catch(() => {});
        } else {
          await interaction.reply(payload).catch(() => {});
        }
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) {
    console.warn(`Received unknown command: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing /${interaction.commandName}:`, error);
    const payload = { content: 'Something went wrong running that command.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

client.login(config.token);
