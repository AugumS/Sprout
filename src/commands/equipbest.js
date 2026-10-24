const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { TOOL_TYPES, RARITY_CIRCLE } = require('../data/tools');
const { getEffectivePrimary } = require('../data/stats');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('equipbest')
    .setDescription('Automatically equip the highest-stat tool of each type from your inventory.'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const tools = db.getInventory(userId, 'tool');

    if (!tools.length) {
      await interaction.reply({ content: "You don't have any tools.", ephemeral: true });
      return;
    }

    // Find the best tool per type by effective primary stat
    const best = {};
    for (const tool of tools) {
      const typeId = tool.item_id;
      if (!TOOL_TYPES[typeId]) continue;
      const effective = getEffectivePrimary(tool);
      if (!best[typeId] || effective > best[typeId].effective) {
        best[typeId] = { tool, effective };
      }
    }

    if (!Object.keys(best).length) {
      await interaction.reply({ content: "No equippable tools found.", ephemeral: true });
      return;
    }

    const equipped = db.getEquipped(userId);
    const lines = [];

    for (const [typeId, { tool, effective }] of Object.entries(best)) {
      const type = TOOL_TYPES[typeId];
      const circle = RARITY_CIRCLE[tool.rarity] || '⚪';
      const label = `${circle} ${type.emoji} **${tool.rarity} ${type.name}** \`#${tool.id}\` — ${Math.round(effective * 100)}% effective`;

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
