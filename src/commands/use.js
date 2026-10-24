const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { listRecipes, getRecipe } = require('../data/recipes');

function formatBoostDuration(boost) {
  if (boost.charges) return `${boost.charges} harvest${boost.charges > 1 ? 's' : ''}`;
  if (boost.durationHours) return `${boost.durationHours} hour${boost.durationHours > 1 ? 's' : ''}`;
  return 'unknown duration';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('use')
    .setDescription('Activate a crafted boost item from your inventory.')
    .addStringOption((o) =>
      o
        .setName('item')
        .setDescription('Which item to use')
        .setRequired(true)
        .addChoices(...listRecipes().map((r) => ({ name: `${r.emoji} ${r.name}`, value: r.id })))
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const recipeId = interaction.options.getString('item', true);
    const recipe = getRecipe(recipeId);

    const stack = db.getInventory(userId, 'consumable').find((c) => c.item_id === recipeId);
    if (!stack || stack.quantity === 0) {
      await interaction.reply({
        content: `You don't have any ${recipe.emoji} **${recipe.name}**. Craft one with \`/craft make\`.`,
        ephemeral: true,
      });
      return;
    }

    const { boost } = recipe;

    const activeBoosts = db.getActiveBoosts(userId);
    const alreadyActive = activeBoosts.find((b) => b.boost_type === boost.type);
    if (alreadyActive) {
      await interaction.reply({
        content: `You already have an active **${recipe.name}** boost. Wait for it to expire or be used up before activating another.`,
        ephemeral: true,
      });
      return;
    }
    const charges = boost.charges ?? null;
    const expiresAt = boost.durationHours ? Date.now() + boost.durationHours * 60 * 60 * 1000 : null;

    db.removeItem(userId, 'consumable', recipeId, 1);
    db.addBoost(userId, boost.type, boost.value, charges, expiresAt);

    const duration = formatBoostDuration(boost);
    const remaining = stack.quantity - 1;

    const lines = [
      `Activated ${recipe.emoji} **${recipe.name}**!`,
      `*${recipe.description}* — lasts **${duration}**.`,
    ];
    if (remaining > 0) lines.push(`You have ${remaining} more.`);

    await interaction.reply({
      embeds: [new EmbedBuilder().setDescription(lines.join('\n')).setColor(0x4a90d9)],
    });
  },
};
