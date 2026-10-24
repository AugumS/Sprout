const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { getToolType, RARITY_CIRCLE } = require('../data/tools');
const {
  getEffectivePrimary,
  getEffectiveShears,
  getEffectiveGolden,
  getEffectiveToolFind,
  expToLevel,
} = require('../data/stats');
const { formatDuration } = require('../game');

const BOOST_META = {
  golden:    { emoji: '🌿', name: 'Golden Fertilizer' },
  grow:      { emoji: '💧', name: 'Growth Tonic' },
  yield:     { emoji: '🧪', name: 'Harvest Elixir' },
  tool_find: { emoji: '🍀', name: 'Lucky Charm' },
  bumper:    { emoji: '⚡', name: 'Bumper Crop' },
};

const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function pct(decimal) {
  return `${Math.round(decimal * 100)}%`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your farming profile and lifetime stats.')
    .addUserOption((o) =>
      o.setName('user').setDescription("View another player's public profile")
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const isSelf = !targetUser || targetUser.id === interaction.user.id;
    const userId = isSelf ? interaction.user.id : targetUser.id;
    const displayName = isSelf ? interaction.user.username : targetUser.username;

    const user = db.getOrCreateUser(userId);
    const equipped = db.getEquipped(userId);

    const toolSlots = [
      { key: 'hoe',         emoji: '⛏️' },
      { key: 'wateringcan', emoji: '🚿' },
      { key: 'shears',      emoji: '✂️' },
    ];

    const toolLines = toolSlots.map(({ key, emoji }) => {
      const t = equipped[key];
      if (!t) return `${emoji} *none equipped*`;
      const type = getToolType(t.item_id);
      const level = expToLevel(t.exp || 0);
      const primary = pct(getEffectivePrimary(t));
      const idPart = isSelf ? ` \`#${t.id}\`` : '';
      return `${RARITY_CIRCLE[t.rarity] || '⚪'} ${emoji} **${t.rarity} ${type?.name}**${idPart} · Lv ${level} · ${primary}`;
    });

    const lifetimeLines = [
      `💰 Gold earned: **${(user.total_gold_earned || 0).toLocaleString()}**`,
      `🌾 Crops harvested: **${(user.total_crops_harvested || 0).toLocaleString()}**`,
      `✨ Golden harvests: **${(user.total_golden_harvests || 0).toLocaleString()}**`,
      `🔧 Tools found: **${(user.total_tool_drops || 0).toLocaleString()}**`,
    ];

    const embed = new EmbedBuilder()
      .setTitle(`${isSelf ? '🌱' : '👀'} ${displayName}'s Farm${isSelf ? '' : ' (Public)'}`)
      .setColor(0x57b86a)
      .addFields(
        {
          name: '💼 Current',
          value: isSelf
            ? `💵 Coins: **${user.currency.toLocaleString()}** · 🪴 Plots: **${user.plot_count}**`
            : `🪴 Plots: **${user.plot_count}**`,
          inline: false,
        },
        { name: '🔧 Equipped Tools', value: toolLines.join('\n'), inline: false },
      );

    if (isSelf) {
      const growReduction = getEffectivePrimary(equipped.hoe);
      const yieldBonus    = getEffectivePrimary(equipped.wateringcan);
      const shearsBonus   = getEffectiveShears(equipped.shears);
      const goldenBonus   = getEffectiveGolden(equipped.hoe) + getEffectiveGolden(equipped.wateringcan) + getEffectiveGolden(equipped.shears);
      const toolFindBonus = getEffectiveToolFind(equipped.hoe) + getEffectiveToolFind(equipped.wateringcan) + getEffectiveToolFind(equipped.shears);

      embed.addFields({
        name: '📊 Combined Stats',
        value: [
          `⏱️ Grow speed: **${pct(growReduction)}** faster`,
          `💰 Yield bonus: **+${pct(yieldBonus)}** per harvest`,
          `✂️ Harvest bonus chance: **${pct(0.1 + shearsBonus)}**`,
          `⭐ Golden chance bonus: **+${pct(goldenBonus)}**`,
          `🔍 Tool find bonus: **+${pct(0.05 + toolFindBonus)}**`,
        ].join('\n'),
        inline: false,
      });

      const boosts = db.getActiveBoosts(userId);
      const now = Date.now();
      const boostLines = boosts.map((b) => {
        const meta = BOOST_META[b.boost_type] || { emoji: '✨', name: b.boost_type };
        const dur = b.charges !== null
          ? `${b.charges} charge${b.charges !== 1 ? 's' : ''}`
          : b.expires_at ? formatDuration(b.expires_at - now) : '∞';
        return `${meta.emoji} ${meta.name} — ${dur}`;
      });

      const dailyReady = !user.last_daily || now - user.last_daily >= DAILY_COOLDOWN_MS;
      const dailyLine = dailyReady
        ? '🎁 Daily reward: **ready!** — use `/daily`'
        : `🎁 Daily reward: ready in **${formatDuration(DAILY_COOLDOWN_MS - (now - user.last_daily))}**`;

      embed.addFields(
        { name: '✨ Active Boosts', value: boostLines.length ? boostLines.join('\n') : '*none*', inline: false },
        { name: '📅 Daily', value: dailyLine, inline: false },
      );
    }

    embed.addFields({ name: '📈 Lifetime', value: lifetimeLines.join('\n'), inline: false });

    await interaction.reply({ embeds: [embed] });
  },
};
