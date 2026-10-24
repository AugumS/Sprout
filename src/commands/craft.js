const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { getCrop } = require('../data/crops');
const { listRecipes, getRecipe } = require('../data/recipes');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('craft')
    .setDescription('Craft boost items from harvested crops.')
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('Show all craftable items and their recipes.')
    )
    .addSubcommand((sub) =>
      sub
        .setName('make')
        .setDescription('Craft an item.')
        .addStringOption((o) =>
          o
            .setName('item')
            .setDescription('What to craft')
            .setRequired(true)
            .addChoices(...listRecipes().map((r) => ({ name: `${r.emoji} ${r.name}`, value: r.id })))
        )
        .addIntegerOption((o) =>
          o.setName('amount').setDescription('How many to craft (default 1)').setMinValue(1).setMaxValue(10)
        )
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const cropInventory = db.getInventory(userId, 'crop');
      const lines = listRecipes().map((r) => {
        const ingList = r.ingredients
          .map((i) => {
            const have = cropInventory.find((c) => c.item_id === i.cropId)?.quantity || 0;
            const ok = have >= i.amount;
            return `${ok ? '✅' : '❌'} ${i.amount}x ${getCrop(i.cropId)?.emoji || ''} ${getCrop(i.cropId)?.name || i.cropId} *(have ${have})*`;
          })
          .join('\n  ');
        return `${r.emoji} **${r.name}** — ${r.description}\n  ${ingList}`;
      });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('📖 Crafting Recipes')
            .setDescription(lines.join('\n\n'))
            .setColor(0x57b86a)
            .setFooter({ text: 'Use /craft make item: to craft · /use item: to activate' }),
        ],
        ephemeral: true,
      });
      return;
    }

    if (sub === 'make') {
      const recipeId = interaction.options.getString('item', true);
      const amount = interaction.options.getInteger('amount') || 1;
      const recipe = getRecipe(recipeId);

      // Check all ingredients
      const cropInventory = db.getInventory(userId, 'crop');
      const missing = [];
      for (const ing of recipe.ingredients) {
        const stack = cropInventory.find((c) => c.item_id === ing.cropId);
        const have = stack ? stack.quantity : 0;
        const need = ing.amount * amount;
        if (have < need) {
          const crop = getCrop(ing.cropId);
          missing.push(`${crop?.emoji} **${crop?.name}**: need ${need}, have ${have}`);
        }
      }

      if (missing.length > 0) {
        await interaction.reply({
          content: `Not enough ingredients:\n${missing.join('\n')}`,
          ephemeral: true,
        });
        return;
      }

      // Consume ingredients and add items to inventory
      for (const ing of recipe.ingredients) {
        db.removeItem(userId, 'crop', ing.cropId, ing.amount * amount);
      }
      db.addItem(userId, 'consumable', recipeId, amount);

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setDescription(`Crafted ${amount}x ${recipe.emoji} **${recipe.name}**. Use it with \`/use item:${recipe.name.toLowerCase().replace(/ /g, '_')}\`.`)
            .setColor(0x57b86a),
        ],
      });
    }
  },
};
