const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { listCrops, getCrop } = require('../data/crops');
const { listToolTypes, getToolType, RARITY_ORDER, RARITY_CIRCLE } = require('../data/tools');
const { rollStats } = require('../data/stats');

const DEV_USER_ID = '559907908364795914';

function isDevUser(interaction) {
  return interaction.user.id === DEV_USER_ID;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dev')
    .setDescription('[Dev only] Testing and debugging commands.')
    .addSubcommand((sub) =>
      sub
        .setName('coins')
        .setDescription('Add (or subtract) coins from a user\'s balance.')
        .addIntegerOption((o) =>
          o.setName('amount').setDescription('Amount to add (use negative to subtract)').setRequired(true)
        )
        .addStringOption((o) =>
          o.setName('user_id').setDescription('Target user ID (defaults to yourself)')
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('seed')
        .setDescription('Give seeds to a user.')
        .addStringOption((o) =>
          o.setName('crop').setDescription('Which crop').setRequired(true)
            .addChoices(...listCrops().map((c) => ({ name: c.name, value: c.id })))
        )
        .addIntegerOption((o) =>
          o.setName('amount').setDescription('How many (default 10)').setMinValue(1)
        )
        .addStringOption((o) =>
          o.setName('user_id').setDescription('Target user ID (defaults to yourself)')
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('tool')
        .setDescription('Give a tool to a user.')
        .addStringOption((o) =>
          o.setName('type').setDescription('Tool type').setRequired(true)
            .addChoices(...listToolTypes().map((t) => ({ name: t.name, value: t.id })))
        )
        .addStringOption((o) =>
          o.setName('rarity').setDescription('Rarity').setRequired(true)
            .addChoices(...RARITY_ORDER.map((r) => ({ name: r, value: r })))
        )
        .addStringOption((o) =>
          o.setName('user_id').setDescription('Target user ID (defaults to yourself)')
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('ready')
        .setDescription('Instantly ripen all crops currently growing in your garden.')
    )
    .addSubcommand((sub) =>
      sub
        .setName('reset')
        .setDescription('Wipe your account completely (coins, plots, inventory).')
    )
    .addSubcommand((sub) =>
      sub
        .setName('inspect')
        .setDescription('Dump raw DB state for a user.')
        .addStringOption((o) =>
          o.setName('user_id').setDescription('Discord user ID (defaults to yourself)')
        )
    ),

  async execute(interaction) {
    if (!isDevUser(interaction)) {
      await interaction.reply({ content: 'This command is for the developer only.', ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const selfId = interaction.user.id;

    if (sub === 'coins') {
      const amount = interaction.options.getInteger('amount', true);
      const targetId = interaction.options.getString('user_id') || selfId;
      db.getOrCreateUser(targetId);
      const newBalance = db.addCurrency(targetId, amount);
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setDescription(`${amount >= 0 ? '+' : ''}${amount} coins → \`${targetId}\`. New balance: **${newBalance}**.`)
          .setColor(0xd98e04)],
        ephemeral: true,
      });
      return;
    }

    if (sub === 'seed') {
      const cropId = interaction.options.getString('crop', true);
      const amount = interaction.options.getInteger('amount') || 10;
      const targetId = interaction.options.getString('user_id') || selfId;
      const crop = getCrop(cropId);
      db.getOrCreateUser(targetId);
      db.addItem(targetId, 'seed', cropId, amount);
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setDescription(`Gave ${amount}x ${crop.emoji} **${crop.name}** seed${amount > 1 ? 's' : ''} to \`${targetId}\`.`)
          .setColor(0x57b86a)],
        ephemeral: true,
      });
      return;
    }

    if (sub === 'tool') {
      const toolTypeId = interaction.options.getString('type', true);
      const rarity = interaction.options.getString('rarity', true);
      const targetId = interaction.options.getString('user_id') || selfId;
      const type = getToolType(toolTypeId);
      const stats = rollStats(toolTypeId, rarity);
      db.getOrCreateUser(targetId);
      const toolId = db.addTool(targetId, toolTypeId, rarity, stats);
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setDescription(`Gave ${RARITY_CIRCLE[rarity] || '⚪'} ${type.emoji} **${rarity} ${type.name}** (ID: \`#${toolId}\`) to \`${targetId}\`.`)
          .setColor(0x4a90d9)],
        ephemeral: true,
      });
      return;
    }

    if (sub === 'ready') {
      db.forceReadyPlots(selfId);
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setDescription('All growing crops are now ready to harvest.')
          .setColor(0x57b86a)],
        ephemeral: true,
      });
      return;
    }

    if (sub === 'reset') {
      db.resetUser(selfId);
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setDescription('Account wiped. You start fresh next time you run a command.')
          .setColor(0xe74c3c)],
        ephemeral: true,
      });
      return;
    }

    if (sub === 'inspect') {
      const targetId = interaction.options.getString('user_id') || selfId;
      const user = db.getOrCreateUser(targetId);
      const plots = db.getPlots(targetId);
      const seeds = db.getInventory(targetId, 'seed');
      const crops = db.getInventory(targetId, 'crop');
      const tools = db.getInventory(targetId, 'tool');
      const equipped = db.getEquipped(targetId);

      const plotLines = plots.map((p) =>
        `[${p.plot_index}] crop=${p.crop_id || 'null'} planted=${p.planted_at || 'null'}`
      );
      const seedLines = seeds.map((s) => `${s.item_id} x${s.quantity}`);
      const cropLines = crops.map((c) => `${c.item_id} x${c.quantity}`);
      const toolLines = tools.map((t) => `[${t.id}] ${t.rarity} ${t.item_id}`);
      const equippedLines = [
        `hoe: ${equipped.hoe ? `[${equipped.hoe.id}] ${equipped.hoe.rarity}` : 'none'}`,
        `wateringcan: ${equipped.wateringcan ? `[${equipped.wateringcan.id}] ${equipped.wateringcan.rarity}` : 'none'}`,
        `shears: ${equipped.shears ? `[${equipped.shears.id}] ${equipped.shears.rarity}` : 'none'}`,
      ];

      const embed = new EmbedBuilder()
        .setTitle(`🔍 Inspect: ${targetId}`)
        .setColor(0x888888)
        .addFields(
          { name: 'Account', value: `Coins: **${user.currency}** | Plots: **${user.plot_count}**`, inline: false },
          { name: `Plots (${plots.length})`, value: plotLines.length ? `\`\`\`\n${plotLines.join('\n')}\n\`\`\`` : '*none*', inline: false },
          { name: `Seeds (${seeds.length} types)`, value: seedLines.length ? seedLines.join(', ') : '*none*', inline: false },
          { name: `Crops (${crops.length} types)`, value: cropLines.length ? cropLines.join(', ') : '*none*', inline: false },
          { name: `Tools (${tools.length})`, value: toolLines.length ? `\`\`\`\n${toolLines.slice(0, 20).join('\n')}${tools.length > 20 ? `\n... +${tools.length - 20} more` : ''}\n\`\`\`` : '*none*', inline: false },
          { name: 'Equipped', value: equippedLines.join('\n'), inline: false },
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }
  },
};
