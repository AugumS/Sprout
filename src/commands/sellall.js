const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { listToolTypes, getToolType, RARITY_ORDER, RARITY_CIRCLE } = require('../data/tools');
const { getToolSellValue } = require('../data/stats');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sellall')
    .setDescription('Bulk-sell tools by rarity or type. Use preview to check before selling.')
    .addStringOption((o) =>
      o
        .setName('max_rarity')
        .setDescription('Sell everything at or below this rarity (e.g. Uncommon sells Common + Uncommon)')
        .addChoices(...RARITY_ORDER.map((r) => ({ name: r, value: r })))
    )
    .addStringOption((o) =>
      o
        .setName('rarity')
        .setDescription('Sell only this exact rarity')
        .addChoices(...RARITY_ORDER.map((r) => ({ name: r, value: r })))
    )
    .addStringOption((o) =>
      o
        .setName('type')
        .setDescription('Sell only this tool type')
        .addChoices(...listToolTypes().map((t) => ({ name: t.name, value: t.id })))
    )
    .addBooleanOption((o) =>
      o.setName('preview').setDescription('Preview what would be sold without actually selling (default: false)')
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const maxRarity  = interaction.options.getString('max_rarity');
    const exactRarity = interaction.options.getString('rarity');
    const itemTypeId  = interaction.options.getString('type');
    const preview     = interaction.options.getBoolean('preview') ?? false;

    if (!maxRarity && !exactRarity && !itemTypeId) {
      await interaction.reply({
        content: 'Provide at least one filter (`max_rarity`, `rarity`, or `type`) so you don\'t accidentally sell everything.',
        ephemeral: true,
      });
      return;
    }

    // Build the rarity filter list
    let rarities = null;
    if (exactRarity) {
      rarities = [exactRarity];
    } else if (maxRarity) {
      const cutoff = RARITY_ORDER.indexOf(maxRarity);
      rarities = RARITY_ORDER.slice(0, cutoff + 1);
    }

    const tools = db.getToolsByFilter(userId, { itemTypeId, rarities });

    // Never sell equipped tools
    const equipped = db.getEquipped(userId);
    const equippedIds = new Set(Object.values(equipped).filter(Boolean).map((t) => t.id));
    const sellable = tools.filter((t) => !equippedIds.has(t.id));
    const skippedEquipped = tools.length - sellable.length;

    if (sellable.length === 0) {
      const reason = skippedEquipped > 0 ? ' (equipped tools are excluded)' : '';
      await interaction.reply({ content: `No matching tools to sell${reason}.`, ephemeral: true });
      return;
    }

    // Calculate totals
    const totalCoins = sellable.reduce((sum, t) => sum + getToolSellValue(t), 0);

    // Group by rarity for the summary
    const byRarity = {};
    for (const t of sellable) {
      byRarity[t.rarity] = (byRarity[t.rarity] || 0) + 1;
    }
    const summaryLines = RARITY_ORDER.filter((r) => byRarity[r]).map(
      (r) => `${RARITY_CIRCLE[r]} ${byRarity[r]}x ${r}`
    );

    if (preview) {
      const lines = [
        `**Would sell ${sellable.length} tool${sellable.length > 1 ? 's' : ''} for ${totalCoins.toLocaleString()} coins:**`,
        ...summaryLines,
      ];
      if (skippedEquipped) lines.push(`*(${skippedEquipped} equipped tool${skippedEquipped > 1 ? 's' : ''} skipped)*`);
      await interaction.reply({
        embeds: [new EmbedBuilder().setDescription(lines.join('\n')).setColor(0x888888)],
        ephemeral: true,
      });
      return;
    }

    // Execute the sale
    for (const t of sellable) {
      db.removeTool(userId, t.id);
    }
    const newBalance = db.addCurrency(userId, totalCoins);

    const lines = [
      `Sold **${sellable.length} tool${sellable.length > 1 ? 's' : ''}** for **${totalCoins.toLocaleString()} coins**.`,
      ...summaryLines,
      `Balance: ${newBalance.toLocaleString()} coins.`,
    ];
    if (skippedEquipped) lines.push(`*(${skippedEquipped} equipped tool${skippedEquipped > 1 ? 's' : ''} kept)*`);

    await interaction.reply({
      embeds: [new EmbedBuilder().setDescription(lines.join('\n')).setColor(0xd98e04)],
    });
  },
};
