const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { getToolType, RARITY_CIRCLE } = require('../data/tools');
const { listCrops, getCrop } = require('../data/crops');
const { getToolSellValue } = require('../data/stats');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sell')
    .setDescription('Sell a tool or harvested crops.')
    .addSubcommand((sub) =>
      sub
        .setName('tool')
        .setDescription('Sell one tool by its ID.')
        .addIntegerOption((o) =>
          o.setName('id').setDescription('Tool ID shown in /inventory').setRequired(true).setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('crop')
        .setDescription('Sell harvested crops from your inventory.')
        .addStringOption((o) =>
          o
            .setName('type')
            .setDescription('Which crop to sell')
            .setRequired(true)
            .addChoices(...listCrops().map((c) => ({ name: c.name, value: c.id })))
        )
        .addIntegerOption((o) =>
          o.setName('amount').setDescription('How many to sell (default: all)').setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('allcrops')
        .setDescription('Sell all harvested crops of every type at once.')
        .addBooleanOption((o) =>
          o.setName('preview').setDescription('Preview what would be sold without actually selling (default: false)')
        )
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();

    // ---- sell tool ----
    if (sub === 'tool') {
      const toolId = interaction.options.getInteger('id', true);
      const tool = db.getToolById(toolId);

      if (!tool || tool.user_id !== userId || tool.item_type !== 'tool') {
        await interaction.reply({ content: `You don't own a tool with ID \`#${toolId}\`.`, ephemeral: true });
        return;
      }

      const equipped = db.getEquipped(userId);
      if (equipped[tool.item_id] && equipped[tool.item_id].id === tool.id) {
        const type = getToolType(tool.item_id);
        await interaction.reply({
          content: `You can't sell your equipped ${tool.rarity} ${type?.name || tool.item_id} — unequip it first with \`/unequip\`.`,
          ephemeral: true,
        });
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
      const sellValue = getToolSellValue(tool);
      db.removeTool(userId, toolId);
      const newBalance = db.addCurrency(userId, sellValue);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setDescription(
              `Sold ${RARITY_CIRCLE[tool.rarity] || '⚪'} ${type?.emoji || '🔧'} **${tool.rarity} ${type?.name || tool.item_id}** for **${sellValue} coins**.\nBalance: ${newBalance.toLocaleString()} coins.`
            )
            .setColor(0xd98e04),
        ],
      });
      return;
    }

    // ---- sell crop ----
    if (sub === 'crop') {
      const cropId = interaction.options.getString('type', true);
      const crop = getCrop(cropId);
      const stack = db.getInventory(userId, 'crop').find((c) => c.item_id === cropId);

      if (!stack || stack.quantity === 0) {
        await interaction.reply({
          content: `You don't have any **${crop.name}** to sell.`,
          ephemeral: true,
        });
        return;
      }

      const amount = Math.min(interaction.options.getInteger('amount') || stack.quantity, stack.quantity);
      const total = crop.sellValue * amount;

      db.removeItem(userId, 'crop', cropId, amount);
      const newBalance = db.addCurrency(userId, total);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setDescription(
              `Sold ${amount}x ${crop.emoji} **${crop.name}** for **${total.toLocaleString()} coins** (${crop.sellValue} each).\nBalance: ${newBalance.toLocaleString()} coins.`
            )
            .setColor(0xd98e04),
        ],
      });
      return;
    }

    if (sub === 'allcrops') {
      const preview = interaction.options.getBoolean('preview') ?? false;
      const allCrops = db.getInventory(userId, 'crop').filter((c) => c.quantity > 0);
      if (allCrops.length === 0) {
        await interaction.reply({ content: "You don't have any harvested crops to sell.", ephemeral: true });
        return;
      }
      let total = 0;
      const lines = [];
      for (const stack of allCrops) {
        const c = getCrop(stack.item_id);
        if (!c) continue;
        const earned = c.sellValue * stack.quantity;
        total += earned;
        lines.push(`${stack.quantity}x ${c.emoji} **${c.name}** — ${earned.toLocaleString()} coins`);
      }

      if (preview) {
        lines.push(`\n**Would earn: ${total.toLocaleString()} coins** — run without \`preview\` to sell.`);
        await interaction.reply({
          embeds: [new EmbedBuilder().setTitle('🧺 Preview: sell all crops').setDescription(lines.join('\n')).setColor(0x888888)],
          ephemeral: true,
        });
        return;
      }

      for (const stack of allCrops) {
        db.removeItem(userId, 'crop', stack.item_id, stack.quantity);
      }
      const newBalance = db.addCurrency(userId, total);
      lines.push(`\n**Total: ${total.toLocaleString()} coins** · Balance: ${newBalance.toLocaleString()}`);
      await interaction.reply({
        embeds: [new EmbedBuilder().setTitle('🧺 Sold all crops').setDescription(lines.join('\n')).setColor(0xd98e04)],
      });
      return;
    }
  },
};
