const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { plotStatus, formatDuration } = require('../game');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('garden')
    .setDescription('View your garden plots and what is growing in them.'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const user = db.getOrCreateUser(userId);
    const plots = db.getPlots(userId);
    const equipped = db.getEquipped(userId);
    const boosts = db.getActiveBoosts(userId);
    const growBoost = boosts.find((b) => b.boost_type === 'grow');
    const extraGrowReduction = (growBoost ? growBoost.value : 0) + (user.upgrade_greenhouse || 0) * 0.05;

    const lines = plots.map((plot) => {
      const status = plotStatus(plot, equipped.hoe, extraGrowReduction);
      const label = `Plot ${status.plotIndex + 1}`;
      if (status.state === 'empty') return `${label}: *empty* — \`/plant\` something here`;
      if (status.state === 'ready') return `${label}: ${status.crop.emoji} ${status.crop.name} — **ready to harvest!**`;
      return `${label}: ${status.crop.emoji} ${status.crop.name} — ready in ${formatDuration(status.remainingMs)}`;
    });

    const embed = new EmbedBuilder()
      .setTitle(`${interaction.user.username}'s Garden`)
      .setDescription(lines.join('\n'))
      .setColor(0x57b86a)
      .setFooter({ text: `${plots.length} plot${plots.length === 1 ? '' : 's'} — /expand to add more` });

    await interaction.reply({ embeds: [embed] });
  },
};
