const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { listCrops, getCrop } = require('../data/crops');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('plant')
    .setDescription('Plant a seed from your inventory into an empty plot.')
    .addStringOption((option) =>
      option
        .setName('crop')
        .setDescription('Which crop to plant')
        .setRequired(true)
        .addChoices(...listCrops().map((crop) => ({ name: crop.name, value: crop.id })))
    )
    .addIntegerOption((option) =>
      option
        .setName('plot')
        .setDescription('Which plot number to plant in (defaults to the first empty one)')
        .setMinValue(1)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const cropId = interaction.options.getString('crop', true);
    const requestedPlot = interaction.options.getInteger('plot');
    const crop = getCrop(cropId);

    const hasSeed = db.removeItem(userId, 'seed', cropId, 1);
    if (!hasSeed) {
      await interaction.reply({
        content: `You don't have a **${crop.name}** seed. Buy one with \`/buy\` first.`,
        ephemeral: true,
      });
      return;
    }

    const plots = db.getPlots(userId);
    let targetIndex;
    if (requestedPlot !== null) {
      const plot = plots.find((p) => p.plot_index === requestedPlot - 1);
      if (!plot) {
        db.addItem(userId, 'seed', cropId, 1); // refund
        await interaction.reply({ content: `You don't have a plot ${requestedPlot}.`, ephemeral: true });
        return;
      }
      if (plot.crop_id) {
        db.addItem(userId, 'seed', cropId, 1); // refund
        await interaction.reply({ content: `Plot ${requestedPlot} already has something growing in it.`, ephemeral: true });
        return;
      }
      targetIndex = plot.plot_index;
    } else {
      const empty = plots.find((p) => !p.crop_id);
      if (!empty) {
        db.addItem(userId, 'seed', cropId, 1); // refund
        await interaction.reply({ content: 'Every plot is full. Harvest something or `/expand` your garden.', ephemeral: true });
        return;
      }
      targetIndex = empty.plot_index;
    }

    db.plantCrop(userId, targetIndex, cropId);

    const embed = new EmbedBuilder()
      .setDescription(`${crop.emoji} Planted **${crop.name}** in plot ${targetIndex + 1}. Check back with \`/garden\`.`)
      .setColor(0x57b86a);

    await interaction.reply({ embeds: [embed] });
  },
};
