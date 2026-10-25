const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const db = require('../db');
const { listCrops } = require('../data/crops');
const { TOOL_TYPES, RARITY_CIRCLE } = require('../data/tools');

const REROLL_COST = 1000;

function formatCountdown(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function buildShopEmbed(userId) {
  const seedLines = listCrops().map(
    (crop) => `${crop.emoji} **${crop.name}** (${crop.rarity}) — ${crop.seedPrice} coins · grows in ${crop.growMinutes}m`
  );

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
    .setFooter({ text: `Tools also drop randomly from harvesting. Shop rotates every 10 minutes. Reroll costs ${REROLL_COST.toLocaleString()} coins.` });

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('See what seeds and tools are for sale.'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const embed = buildShopEmbed(userId);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`shop_reroll:${userId}`)
        .setLabel(`🎲 Reroll Shop (${REROLL_COST.toLocaleString()} coins)`)
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  },

  async handleButton(interaction) {
    const [prefix, ownerId] = interaction.customId.split(':');

    if (interaction.user.id !== ownerId) {
      await interaction.reply({ content: "That's not your shop.", ephemeral: true });
      return;
    }

    if (prefix === 'shop_reroll') {
      const user = db.getOrCreateUser(ownerId);
      if (user.currency < REROLL_COST) {
        await interaction.reply({
          content: `You need **${REROLL_COST.toLocaleString()} coins** to reroll (you have ${user.currency.toLocaleString()}).`,
          ephemeral: true,
        });
        return;
      }

      db.rerollShop(ownerId);

      const embed = buildShopEmbed(ownerId);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`shop_reroll:${ownerId}`)
          .setLabel(`🎲 Reroll Shop (${REROLL_COST.toLocaleString()} coins)`)
          .setStyle(ButtonStyle.Secondary),
      );

      await interaction.update({ embeds: [embed], components: [row] });
    }
  },
};
