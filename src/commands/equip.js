const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { getToolType, RARITY_CIRCLE } = require('../data/tools');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('equip')
    .setDescription('Equip a tool by its ID (shown in /inventory).')
    .addIntegerOption((o) =>
      o.setName('id').setDescription('Tool ID, e.g. 42').setRequired(true).setMinValue(1)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const toolId = interaction.options.getInteger('id', true);

    const tool = db.getToolById(toolId);

    if (!tool || tool.user_id !== userId || tool.item_type !== 'tool') {
      await interaction.reply({ content: `You don't own a tool with ID \`#${toolId}\`.`, ephemeral: true });
      return;
    }

    if (db.isToolListed(toolId)) {
      await interaction.reply({
        content: `That tool is listed on the market. Cancel the listing with \`/market cancel\` first.`,
        ephemeral: true,
      });
      return;
    }

    const type = getToolType(tool.item_id);
    db.equipTool(userId, tool.item_id, tool.id);

    const embed = new EmbedBuilder()
      .setDescription(`Equipped ${RARITY_CIRCLE[tool.rarity] || '⚪'} ${type?.emoji || '🔧'} **${tool.rarity} ${type?.name || tool.item_id}** \`#${tool.id}\`. ${type?.description || ''}.`)
      .setColor(0x4a90d9);

    await interaction.reply({ embeds: [embed] });
  },
};
