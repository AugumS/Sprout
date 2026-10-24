const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { listCrops } = require('../data/crops');
const { TOOL_TYPES, RARITY_CIRCLE } = require('../data/tools');

function formatCountdown(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('See what seeds and tools are for sale.'),

  async execute(interaction) {
    const seedLines = listCrops().map(
      (crop) => `${crop.emoji} **${crop.name}** (${crop.rarity}) — ${crop.seedPrice} coins · grows in ${crop.growMinutes}m`
    );

    const userId = interaction.user.id;
    const stock = db.getShopStock(userId);
    const nextRefresh = db.shopNextRefresh(userId);
    const timeLeft = Math.max(0, nextRefresh - Date.now());

    const toolLines = stock.map((row, i) => {
      const type = TOOL_TYPES[row.tool_type];
      const circle = RARITY_CIRCLE[row.rarity] || '⚪';
      if (row.sold) {
        return `~~\`${i + 1}.\` ${circle} ${type?.emoji} ${row.rarity} ${type?.name}~~ **SOLD**`;
      }
      return `\`${i + 1}.\` ${circle} ${type?.emoji} **${row.rarity} ${type?.name}** — ${row.price.toLocaleString()} coins`;
    });

    const embed = new EmbedBuilder()
      .setTitle('🏪 Garden Shop')
      .addFields(
        { name: '🌱 Seeds — `/buy seed`', value: seedLines.join('\n'), inline: false },
        {
          name: `🔧 Today's Tools — \`/buy tool slot:\` · refreshes in ${formatCountdown(timeLeft)}`,
          value: toolLines.join('\n'),
          inline: false,
        },
      )
      .setColor(0xd98e04)
      .setFooter({ text: 'Tools also drop randomly from harvesting. Shop rotates every 8 hours.' });

    await interaction.reply({ embeds: [embed] });
  },
};
