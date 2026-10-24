const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { TOOL_TYPES, RARITY_CIRCLE } = require('../data/tools');
const { getEffectivePrimary, getLevelBonus, expToLevel } = require('../data/stats');

function statTotal(tool) {
  const stats = tool.stats ? (typeof tool.stats === 'string' ? JSON.parse(tool.stats) : tool.stats) : {};
  const rolled = Object.values(stats).reduce((sum, v) => sum + v, 0);
  const levelBonus = Math.round(getLevelBonus(expToLevel(tool.exp || 0)) * 100);
  return rolled + levelBonus;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('equipbest')
    .setDescription('Automatically equip the highest total stat tool of each type from your inventory.'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const tools = db.getInventory(userId, 'tool');

    if (!tools.length) {
      await interaction.reply({ content: "You don't have any tools.", ephemeral: true });
      return;
    }

    // Find the best tool per type by total stat points (all stats + level bonus)
    const best = {};
    for (const tool of tools) {
      const typeId = tool.item_id;
      if (!TOOL_TYPES[typeId]) continue;
      const total = statTotal(tool);
      if (!best[typeId] || total > best[typeId].total) {
        best[typeId] = { tool, total };
      }
    }

    if (!Object.keys(best).length) {
      await interaction.reply({ content: "No equippable tools found.", ephemeral: true });
      return;
    }

    const equipped = db.getEquipped(userId);
    const lines = [];

    for (const [typeId, { tool, total }] of Object.entries(best)) {
      const type = TOOL_TYPES[typeId];
      const circle = RARITY_CIRCLE[tool.rarity] || '⚪';
      const label = `${circle} ${type.emoji} **${tool.rarity} ${type.name}** \`#${tool.id}\` — ${total}% total`;

      const alreadyEquipped = equipped[typeId] && equipped[typeId].id === tool.id;
      if (alreadyEquipped) {
        lines.push(`${label} *(already equipped)*`);
      } else {
        db.equipTool(userId, typeId, tool.id);
        lines.push(`✅ ${label}`);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('⚡ Best Gear Equipped')
      .setDescription(lines.join('\n'))
      .setColor(0x57b86a);

    await interaction.reply({ embeds: [embed] });
  },
};
