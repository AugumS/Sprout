const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { listAchievements } = require('../data/achievements');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('achievements')
    .setDescription('View your earned achievements and what you\'re still working toward.'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const earned = db.getAchievements(userId);
    const all = listAchievements();

    const earnedList = all.filter((a) => earned.has(a.id));
    const pendingList = all.filter((a) => !earned.has(a.id));

    const earnedLines = earnedList.length
      ? earnedList.map((a) => `${a.emoji} **${a.name}** ✅\n*${a.description}*`)
      : ['*None yet — get farming!*'];

    const pendingLines = pendingList
      .map((a) => `⬜ **${a.name}**\n*${a.description}*`);

    const embed = new EmbedBuilder()
      .setTitle(`🏆 ${interaction.user.username}'s Achievements`)
      .setDescription(`${earnedList.length}/${all.length} unlocked`)
      .setColor(0xf2b705)
      .addFields(
        { name: `✅ Earned (${earnedList.length})`, value: earnedLines.join('\n\n'), inline: false },
      );

    if (pendingLines.length) {
      embed.addFields({ name: `⬜ Locked (${pendingLines.length})`, value: pendingLines.join('\n\n'), inline: false });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
