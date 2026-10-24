const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { plotStatus, rollHarvest } = require('../game');
const { rollRarity, TOOL_TYPES, RARITY_CIRCLE } = require('../data/tools');
const { rollStats, getEffectiveShears, getEffectiveGolden, getEffectiveToolFind, EXP_PER_RARITY, expToLevel } = require('../data/stats');
const { getAchievement } = require('../data/achievements');

const TOOL_DROP_CHANCE = 0.05;
const SHEARS_BONUS_CHANCE_BASE = 0.1;
const MAX_TOOLS = 75;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('harvest')
    .setDescription('Harvest everything ready in your garden (or one specific plot).')
    .addIntegerOption((option) =>
      option.setName('plot').setDescription('Harvest only this plot number').setMinValue(1)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const requestedPlot = interaction.options.getInteger('plot');
    const user = db.getOrCreateUser(userId);
    const equipped = db.getEquipped(userId);
    const boosts = db.getActiveBoosts(userId);

    const growBoost     = boosts.find((b) => b.boost_type === 'grow');
    const goldenBoost   = boosts.find((b) => b.boost_type === 'golden');
    const yieldBoost    = boosts.find((b) => b.boost_type === 'yield');
    const toolFindBoost = boosts.find((b) => b.boost_type === 'tool_find');
    const bumperBoost   = boosts.find((b) => b.boost_type === 'bumper');

    const extraGrowReduction = (growBoost ? growBoost.value : 0) + (user.upgrade_greenhouse || 0) * 0.05;
    const goldenBonus   = getEffectiveGolden(equipped.hoe) + getEffectiveGolden(equipped.wateringcan) + getEffectiveGolden(equipped.shears) + (goldenBoost ? goldenBoost.value : 0);
    const toolFindBonus = getEffectiveToolFind(equipped.hoe) + getEffectiveToolFind(equipped.wateringcan) + getEffectiveToolFind(equipped.shears) + (toolFindBoost ? toolFindBoost.value : 0);
    const extraYieldBonus = yieldBoost ? yieldBoost.value : 0;
    const bonusExpPerCrop = user.upgrade_composter || 0;

    const plots = db.getPlots(userId);
    const targets = plots.filter((plot) => {
      if (requestedPlot !== null && plot.plot_index !== requestedPlot - 1) return false;
      return plotStatus(plot, equipped.hoe, extraGrowReduction).state === 'ready';
    });

    if (targets.length === 0) {
      await interaction.reply({
        content: requestedPlot
          ? `Plot ${requestedPlot} isn't ready to harvest yet.`
          : "Nothing is ready to harvest yet. Check `/garden` for timers.",
        ephemeral: true,
      });
      return;
    }

    const currentToolCount = db.countTools(userId);

    let totalPayout = 0;
    let goldenCount = 0;
    const cropCounts = {};
    const toolDrops = [];

    // Track EXP to award per tool across all plots (keyed by inventory row id)
    const expTracker = {};
    for (const toolRow of Object.values(equipped).filter(Boolean)) {
      expTracker[toolRow.id] = { toolRow, oldLevel: expToLevel(toolRow.exp || 0), expAdded: 0 };
    }

    for (const plot of targets) {
      const status = plotStatus(plot, equipped.hoe, extraGrowReduction);
      const { payout, isGolden } = rollHarvest(status.crop, equipped.wateringcan, goldenBonus, extraYieldBonus);
      totalPayout += payout;
      if (isGolden) goldenCount += 1;
      cropCounts[status.crop.name] = (cropCounts[status.crop.name] || 0) + 1;
      db.addItem(userId, 'crop', status.crop.id, 1);
      db.clearPlot(userId, plot.plot_index);

      const shearsBonusChance = equipped.shears
        ? SHEARS_BONUS_CHANCE_BASE + getEffectiveShears(equipped.shears)
        : 0;
      if (Math.random() < shearsBonusChance) {
        const bonus = Math.round(status.crop.sellValue * 0.5);
        totalPayout += bonus;
      }

      if (currentToolCount + toolDrops.length < MAX_TOOLS && Math.random() < TOOL_DROP_CHANCE + toolFindBonus) {
        const toolTypeIds = Object.keys(TOOL_TYPES);
        const toolType = toolTypeIds[Math.floor(Math.random() * toolTypeIds.length)];
        const rarity = rollRarity();
        const stats = rollStats(toolType, rarity);
        db.addTool(userId, toolType, rarity, stats);
        toolDrops.push(`${RARITY_CIRCLE[rarity] || '⚪'} ${TOOL_TYPES[toolType].emoji} ${rarity} ${TOOL_TYPES[toolType].name}`);
      }

      // Accumulate EXP for each equipped tool (composter upgrade adds bonus EXP)
      const cropExp = (EXP_PER_RARITY[status.crop.rarity] || 1) + bonusExpPerCrop;
      for (const entry of Object.values(expTracker)) {
        entry.expAdded += cropExp;
      }
    }

    if (bumperBoost) totalPayout = Math.round(totalPayout * bumperBoost.value);

    db.addCurrency(userId, totalPayout);
    db.consumeBoostCharges(userId);
    db.addLifetimeStats(userId, {
      gold: totalPayout,
      crops: targets.length,
      goldens: goldenCount,
      toolDrops: toolDrops.length,
    });

    const newAchievements = db.checkAndAwardAchievements(userId);

    // Flush EXP + gold to DB and detect level-ups
    const equippedCount = Object.values(expTracker).length || 1;
    const levelUps = [];
    for (const { toolRow, oldLevel, expAdded } of Object.values(expTracker)) {
      db.addToolExp(toolRow.id, expAdded);
      db.addToolGold(toolRow.id, Math.round(totalPayout / equippedCount));
      const newLevel = expToLevel((toolRow.exp || 0) + expAdded);
      if (newLevel > oldLevel) {
        const type = TOOL_TYPES[toolRow.item_id];
        levelUps.push(`🆙 ${RARITY_CIRCLE[toolRow.rarity] || '⚪'} ${type?.emoji} ${toolRow.rarity} ${type?.name} levelled up to **Level ${newLevel}!**`);
      }
    }

    const cropSummary = Object.entries(cropCounts)
      .map(([name, count]) => `${count}x ${name}`)
      .join(', ');

    const lines = [`Harvested: ${cropSummary}`, `Earned **${totalPayout}** coins${goldenCount ? ` (${goldenCount} golden! ✨)` : ''}${bumperBoost ? ' ⚡ (Bumper Crop!)' : ''}`];
    if (toolDrops.length) lines.push(`Found a tool: ${toolDrops.join(', ')}`);
    if (levelUps.length) lines.push('', ...levelUps);
    if (newAchievements.length) {
      lines.push('', ...newAchievements.map((id) => {
        const a = getAchievement(id);
        return `🏆 Achievement unlocked: ${a?.emoji} **${a?.name}**`;
      }));
    }

    const embed = new EmbedBuilder()
      .setTitle('Harvest complete')
      .setDescription(lines.join('\n'))
      .setColor(0xf2b705);

    await interaction.reply({ embeds: [embed] });
  },
};
