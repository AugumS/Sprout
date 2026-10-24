const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { listCrops, getCrop } = require('../data/crops');
const { getToolType, RARITY_CIRCLE } = require('../data/tools');
const { rollStats } = require('../data/stats');
const { getAchievement } = require('../data/achievements');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Buy seeds or tools from the shop.')
    .addSubcommand((sub) =>
      sub
        .setName('seed')
        .setDescription('Buy crop seeds')
        .addStringOption((option) =>
          option
            .setName('crop')
            .setDescription('Which crop seed to buy')
            .setRequired(true)
            .addChoices(...listCrops().map((c) => ({ name: c.name, value: c.id })))
        )
        .addIntegerOption((option) =>
          option.setName('amount').setDescription('How many (default 1)').setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('tool')
        .setDescription('Buy a tool from the rotating shop (use /shop to see what\'s available).')
        .addIntegerOption((option) =>
          option
            .setName('slot')
            .setDescription('Slot number shown in /shop (1–6)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(6)
        )
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();

    if (sub === 'seed') {
      const cropId = interaction.options.getString('crop', true);
      const amount = interaction.options.getInteger('amount') || 1;
      const crop = getCrop(cropId);
      const user = db.getOrCreateUser(userId);
      const scarecrowLevel = user.upgrade_scarecrow || 0;
      const discount = scarecrowLevel * 0.1;
      const cost = Math.round(crop.seedPrice * (1 - discount)) * amount;

      if (user.currency < cost) {
        const priceEach = Math.round(crop.seedPrice * (1 - discount));
        await interaction.reply({ content: `Not enough coins — ${crop.name} seeds cost ${priceEach} each${discount > 0 ? ` (${Math.round(discount * 100)}% Scarecrow discount applied)` : ''}, you need ${cost}.`, ephemeral: true });
        return;
      }

      db.addCurrency(userId, -cost);
      db.addItem(userId, 'seed', cropId, amount);

      const embed = new EmbedBuilder()
        .setDescription(`Bought ${amount}x ${crop.emoji} **${crop.name}** seed${amount > 1 ? 's' : ''} for ${cost} coins${discount > 0 ? ` (${Math.round(discount * 100)}% off)` : ''}.`)
        .setColor(0xd98e04);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (sub === 'tool') {
      const slot = interaction.options.getInteger('slot', true) - 1; // 0-indexed internally
      const result = db.buyShopSlot(userId, slot);

      if (!result.ok) {
        const messages = {
          invalid_slot: 'That slot doesn\'t exist. Check `/shop` for available slots.',
          already_sold: 'That tool has already been sold — check `/shop` to see what\'s still available.',
          refreshed: 'The shop just refreshed! Check `/shop` to see the new stock.',
          no_funds: `Not enough coins — that tool costs **${result.price?.toLocaleString()}** coins.`,
        };
        await interaction.reply({ content: messages[result.reason] || 'Something went wrong.', ephemeral: true });
        return;
      }

      const type = getToolType(result.toolType);
      const stats = rollStats(result.toolType, result.rarity);
      db.addTool(userId, result.toolType, result.rarity, stats);
      const newAchievements = db.checkAndAwardAchievements(userId);

      const descLines = [
        `Bought ${RARITY_CIRCLE[result.rarity] || '⚪'} ${type?.emoji} **${result.rarity} ${type?.name}** for ${result.price.toLocaleString()} coins. Equip it with \`/equip\`.`,
      ];
      if (newAchievements.length) {
        descLines.push('', ...newAchievements.map((id) => {
          const a = getAchievement(id);
          return `🏆 Achievement unlocked: ${a?.emoji} **${a?.name}**`;
        }));
      }

      const embed = new EmbedBuilder()
        .setDescription(descLines.join('\n'))
        .setColor(0xd98e04);
      await interaction.reply({ embeds: [embed] });
    }
  },
};
