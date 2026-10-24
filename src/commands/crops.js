const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { listCrops } = require('../data/crops');

function coinsPerHour(crop) {
  const profit = crop.sellValue - crop.seedPrice;
  return Math.round((profit / crop.growMinutes) * 60);
}

function formatGrow(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('crops')
    .setDescription('Show all crops with grow time, sell value, and profitability.'),

  async execute(interaction) {
    const cropList = listCrops();

    const lines = cropList.map((c) => {
      const profit = c.sellValue - c.seedPrice;
      const perHour = coinsPerHour(c);
      const perHourStr = perHour > 0 ? `+${perHour}/hr` : `${perHour}/hr`;
      return [
        `${c.emoji} **${c.name}** *(${c.rarity})*`,
        `> Grows in **${formatGrow(c.growMinutes)}** · Seed **${c.seedPrice}c** · Sells **${c.sellValue}c** · Profit **${profit > 0 ? '+' : ''}${profit}c** · ${perHourStr} per plot`,
      ].join('\n');
    });

    const embed = new EmbedBuilder()
      .setTitle('🌾 Crop Guide')
      .setDescription(lines.join('\n\n'))
      .setColor(0x57b86a)
      .setFooter({ text: 'Coins/hr assumes one plot, no tool bonuses · Golden harvests not included' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
