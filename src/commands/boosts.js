const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { listRecipes } = require('../data/recipes');
const { formatDuration } = require('../game');

const BOOST_META = {
  golden:    { name: 'Golden Fertilizer', emoji: '🌿' },
  grow:      { name: 'Growth Tonic',      emoji: '💧' },
  yield:     { name: 'Harvest Elixir',    emoji: '🧪' },
  tool_find: { name: 'Lucky Charm',       emoji: '🍀' },
  bumper:    { name: 'Bumper Crop',       emoji: '⚡' },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('boosts')
    .setDescription('View your currently active boosts and how long they last.'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const boosts = db.getActiveBoosts(userId);

    if (boosts.length === 0) {
      await interaction.reply({
        content: 'You have no active boosts. Craft some with `/craft make` and activate them with `/use`.',
        ephemeral: true,
      });
      return;
    }

    const now = Date.now();
    const lines = boosts.map((b) => {
      const meta = BOOST_META[b.boost_type] || { name: b.boost_type, emoji: '✨' };
      let duration;
      if (b.charges !== null) {
        duration = `**${b.charges}** charge${b.charges !== 1 ? 's' : ''} remaining`;
      } else if (b.expires_at) {
        const remaining = b.expires_at - now;
        duration = remaining > 0 ? `expires in **${formatDuration(remaining)}**` : 'expiring...';
      } else {
        duration = 'permanent';
      }
      return `${meta.emoji} **${meta.name}** (+${Math.round(b.value * 100)}%) — ${duration}`;
    });

    const consumables = db.getInventory(userId, 'consumable');
    const stockLines = listRecipes()
      .map((r) => {
        const stack = consumables.find((c) => c.item_id === r.id);
        const qty = stack ? stack.quantity : 0;
        if (qty === 0) return null;
        return `${r.emoji} **${r.name}** x${qty} *(in inventory)*`;
      })
      .filter(Boolean);

    const embed = new EmbedBuilder()
      .setTitle('✨ Active Boosts')
      .setDescription(lines.join('\n'))
      .setColor(0xf2b705);

    if (stockLines.length) {
      embed.addFields({ name: '📦 In inventory (not yet activated)', value: stockLines.join('\n'), inline: false });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
