const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { listCrops, getCrop } = require('../data/crops');
const { getAchievement } = require('../data/achievements');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('plantall')
    .setDescription('Fill every empty plot with the same crop.')
    .addStringOption((o) =>
      o
        .setName('crop')
        .setDescription('Which crop to plant')
        .setRequired(true)
        .addChoices(...listCrops().map((c) => ({ name: c.name, value: c.id })))
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const cropId = interaction.options.getString('crop', true);
    const crop = getCrop(cropId);

    const plots = db.getPlots(userId);
    const emptyPlots = plots.filter((p) => !p.crop_id);

    if (emptyPlots.length === 0) {
      await interaction.reply({
        content: `Every plot is full. Harvest something or \`/expand\` your garden.`,
        ephemeral: true,
      });
      return;
    }

    const seeds = db.getInventory(userId, 'seed').find((s) => s.item_id === cropId);
    const seedCount = seeds ? seeds.quantity : 0;

    if (seedCount === 0) {
      await interaction.reply({
        content: `You don't have any **${crop.name}** seeds. Buy some with \`/buy seed\`.`,
        ephemeral: true,
      });
      return;
    }

    const toPlant = Math.min(emptyPlots.length, seedCount);
    const skipped = emptyPlots.length - toPlant;

    db.removeItem(userId, 'seed', cropId, toPlant);
    for (let i = 0; i < toPlant; i++) {
      db.plantCrop(userId, emptyPlots[i].plot_index, cropId);
    }

    const newAchievements = db.checkAndAwardAchievements(userId);

    const lines = [
      `${crop.emoji} Planted **${crop.name}** in ${toPlant} plot${toPlant > 1 ? 's' : ''}.`,
    ];
    if (skipped > 0) {
      lines.push(`Not enough seeds for the remaining ${skipped} empty plot${skipped > 1 ? 's' : ''} — buy more with \`/buy seed\`.`);
    }
    if (newAchievements.length) {
      lines.push('', ...newAchievements.map((id) => {
        const a = getAchievement(id);
        return `🏆 Achievement unlocked: ${a?.emoji} **${a?.name}**`;
      }));
    }

    const embed = new EmbedBuilder()
      .setDescription(lines.join('\n'))
      .setColor(0x57b86a);

    await interaction.reply({ embeds: [embed] });
  },
};
