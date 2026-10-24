const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { getCrop } = require('../data/crops');
const { getToolType, RARITY_CIRCLE } = require('../data/tools');

const TOOLS_PER_PAGE = 12;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inventory')
    .setDescription('View your coins, seeds, harvested crops, and tools.')
    .addStringOption((o) =>
      o
        .setName('show')
        .setDescription('Which section to show (default: all)')
        .addChoices(
          { name: 'All', value: 'all' },
          { name: 'Seeds', value: 'seeds' },
          { name: 'Crops', value: 'crops' },
          { name: 'Tools', value: 'tools' }
        )
    )
    .addIntegerOption((o) =>
      o.setName('page').setDescription('Tool page number (default 1)').setMinValue(1)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const show = interaction.options.getString('show') || 'all';
    const page = interaction.options.getInteger('page') || 1;

    const user = db.getOrCreateUser(userId);
    const equipped = db.getEquipped(userId);

    const embed = new EmbedBuilder()
      .setTitle(`${interaction.user.username}'s Inventory`)
      .setColor(0x4a90d9);

    if (show === 'all' || show === 'seeds') {
      const seeds = db.getInventory(userId, 'seed');
      const seedLines = seeds.length
        ? seeds.map((s) => `${getCrop(s.item_id)?.emoji || '🌱'} ${getCrop(s.item_id)?.name || s.item_id} x${s.quantity}`)
        : ['none'];
      embed.addFields({ name: 'Seeds', value: seedLines.join('\n'), inline: true });
    }

    if (show === 'all' || show === 'crops') {
      const crops = db.getInventory(userId, 'crop');
      const cropLines = crops.length
        ? crops.map((c) => `${getCrop(c.item_id)?.emoji || '🧺'} ${getCrop(c.item_id)?.name || c.item_id} x${c.quantity}`)
        : ['none'];
      embed.addFields({ name: 'Crops', value: cropLines.join('\n'), inline: true });
    }

    if (show === 'all' || show === 'tools') {
      const tools = db.getInventory(userId, 'tool');
      const totalPages = Math.max(1, Math.ceil(tools.length / TOOLS_PER_PAGE));
      const clampedPage = Math.min(page, totalPages);
      const start = (clampedPage - 1) * TOOLS_PER_PAGE;
      const paginated = tools.slice(start, start + TOOLS_PER_PAGE);

      const toolLines = paginated.length
        ? paginated.map((t) => {
            const type = getToolType(t.item_id);
            const isEquipped = equipped[t.item_id] && equipped[t.item_id].id === t.id;
            return `${RARITY_CIRCLE[t.rarity] || '⚪'} ${type?.emoji || '🔧'} ${t.rarity} ${type?.name || t.item_id} \`#${t.id}\`${isEquipped ? ' *(equipped)*' : ''} — \`/inspect ${t.id}\``;
          })
        : ['none'];

      const toolHeader = tools.length > TOOLS_PER_PAGE
        ? `Tools (${tools.length} total — page ${clampedPage}/${totalPages})`
        : `Tools (${tools.length})`;
      embed.addFields({ name: toolHeader, value: toolLines.join('\n'), inline: false });

    }

    embed.addFields({ name: 'Coins', value: `${user.currency.toLocaleString()}`, inline: false });

    await interaction.reply({ embeds: [embed] });
  },
};
