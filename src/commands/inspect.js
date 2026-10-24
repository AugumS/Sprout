const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { getToolType, RARITY_TIERS, RARITY_CIRCLE } = require('../data/tools');
const {
  STAT_DEFS,
  PRIMARY_RANGES,
  formatStats,
  getStatRange,
  getEffectivePrimary,
  MAX_LEVEL,
  expToLevel,
  expForLevel,
  expToNextLevel,
  getLevelBonus,
} = require('../data/stats');

const RARITY_COLORS = {
  Common:   0xaaaaaa,
  Uncommon: 0x57b86a,
  Rare:     0x4a90d9,
  Epic:     0xa855f7,
  Mythic:   0xf2b705,
};

function expBar(totalExp, barLength = 12) {
  const level = expToLevel(totalExp);
  if (level >= MAX_LEVEL) return `${'█'.repeat(barLength)} MAX`;
  const prevExp = expForLevel(level);
  const nextExp = expForLevel(level + 1);
  const progress = (totalExp - prevExp) / (nextExp - prevExp);
  const filled = Math.round(progress * barLength);
  return `${'█'.repeat(filled)}${'░'.repeat(barLength - filled)}`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inspect')
    .setDescription('View the stats of a tool you own (omit id to inspect your latest).')
    .addIntegerOption((o) =>
      o.setName('id').setDescription('Tool ID shown in /inventory — omit to see your latest tool').setMinValue(1)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const toolId = interaction.options.getInteger('id');

    const tool = toolId ? db.getToolById(toolId) : db.getLatestTool(userId);

    if (!tool || tool.user_id !== userId || tool.item_type !== 'tool') {
      const msg = toolId
        ? `You don't own a tool with ID \`#${toolId}\`.`
        : `You don't have any tools yet.`;
      await interaction.reply({ content: msg, ephemeral: true });
      return;
    }

    const type = getToolType(tool.item_id);
    const equipped = db.getEquipped(userId);
    const isEquipped = equipped[tool.item_id] && equipped[tool.item_id].id === tool.id;
    const sellValue = Math.round((RARITY_TIERS[tool.rarity]?.shopPrice || 0) * 0.4);

    const stats = tool.stats ? JSON.parse(tool.stats) : null;
    const rarityMax = (PRIMARY_RANGES[tool.rarity] || [1, 5])[1];
    const statLines = stats
      ? Object.entries(stats).map(([key, val]) => {
          const def = STAT_DEFS[key];
          if (!def) return null;
          const isPrimary = def.primary_for === tool.item_id;
          if (isPrimary) {
            const desc = type?.description || '';
            return `${def.emoji} **${def.name}:** ${val}% / ${rarityMax}% max — *${desc}*`;
          }
          const range = getStatRange(key, tool.item_id, tool.rarity);
          const rangeStr = range ? ` *(${range[0]}–${range[1]})*` : '';
          return `${def.emoji} **${def.name}:** ${val}%${rangeStr}`;
        }).filter(Boolean)
      : ['*No stats (legacy tool)*'];

    const totalExp = tool.exp || 0;
    const level = expToLevel(totalExp);
    const levelBonus = getLevelBonus(level);
    const effectivePrimary = Math.round(getEffectivePrimary(tool) * 100);
    const basePrimary = effectivePrimary - Math.round(levelBonus * 100);

    // EXP progress line
    let expLine;
    if (level >= MAX_LEVEL) {
      expLine = `**Level ${level}** (MAX) — ${totalExp.toLocaleString()} total EXP`;
    } else {
      const needed = expToNextLevel(totalExp);
      expLine = `**Level ${level}** — \`${expBar(totalExp)}\` ${needed.toLocaleString()} EXP to next`;
    }

    const lines = [
      expLine,
      levelBonus > 0 ? `📈 Level bonus: +${Math.round(levelBonus * 100)}% (base ${basePrimary}% → **${effectivePrimary}%** effective)` : `📈 Primary: **${effectivePrimary}%**`,
      '',
      ...statLines,
      '',
      `💰 Gold harvested: **${(tool.gold_harvested || 0).toLocaleString()}** coins`,
      `📦 Sell value: ${sellValue} coins`,
      isEquipped ? '✅ Currently equipped' : `💡 Equip with \`/equip\``,
    ];

    const embed = new EmbedBuilder()
      .setTitle(`${RARITY_CIRCLE[tool.rarity] || '⚪'} ${type?.emoji || '🔧'} ${tool.rarity} ${type?.name || tool.item_id}  ·  #${tool.id}`)
      .setDescription(lines.join('\n'))
      .setColor(RARITY_COLORS[tool.rarity] || 0x888888);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
