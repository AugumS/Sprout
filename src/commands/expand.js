const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { expandCost } = require('../game');

const MAX_PLOTS = 25;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('expand')
    .setDescription('Spend coins to add another plot to your garden.'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const user = db.getOrCreateUser(userId);

    if (user.plot_count >= MAX_PLOTS) {
      await interaction.reply({
        content: `Your garden is already at the maximum size of **${MAX_PLOTS} plots**. That's a lot of crops!`,
        ephemeral: true,
      });
      return;
    }

    const cost = expandCost(user.plot_count);

    if (user.currency < cost) {
      await interaction.reply({
        content: `Expanding to ${user.plot_count + 1} plots costs **${cost}** coins — you have ${user.currency}.`,
        ephemeral: true,
      });
      return;
    }

    db.addCurrency(userId, -cost);
    const newCount = db.expandGarden(userId);

    const embed = new EmbedBuilder()
      .setDescription(`🌱 Your garden now has **${newCount}** plots! That cost ${cost} coins.`)
      .setColor(0x57b86a);
    await interaction.reply({ embeds: [embed] });
  },
};
