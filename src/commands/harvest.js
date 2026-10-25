const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { plotStatus, rollHarvest } = require('../game');
const { rollRarity, TOOL_TYPES, RARITY_CIRCLE } = require('../data/tools');
const { getCrop } = require('../data/crops');
const {
  rollStats,
  getEffectiveShears, getEffectiveGolden, getEffectiveToolFind,
  getEffectiveBonusYield, getEffectiveXpBoost, getEffectiveCoinBonus,
  getEffectiveSeedReturn, getEffectiveDoubleDrop,
  EXP_PER_RARITY, expToLevel,
} = require('../data/stats');
const { getAchievement } = require('../data/achievements');

const TOOL_DROP_CHANCE = 0.05;
const SHEARS_BONUS_CHANCE_BASE = 0.1;
const MAX_TOOLS = 75;

function sumStat(fn, equipped) {
  return fn(equipped.hoe) + fn(equipped.wateringcan) + fn(equipped.shears);
}

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
    const goldenBonus    = sumStat(getEffectiveGolden, equipped)   + (goldenBoost   ? goldenBoost.value   : 0);
    const toolFindBonus  = sumStat(getEffectiveToolFind, equipped)  + (toolFindBoost ? toolFindBoost.value : 0);
    const extraYieldBonus = yieldBoost ? yieldBoost.value : 0;
    const bonusExpPerCrop = user.upgrade_composter || 0;

    const bonusYieldChance = sumStat(getEffectiveBonusYield, equipped);
    const coinBonusTotal   = sumStat(getEffectiveCoinBonus, equipped);
    const seedReturnChance = sumStat(getEffectiveSeedReturn, equipped);
    const doubleDropChance = sumStat(getEffectiveDoubleDrop, equipped);

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
    let bonusYieldCount = 0;
    const cropCounts = {};
    const cropIdCounts = {};
    const harvestedCropIds = [];
    const toolDrops = [];

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
      cropIdCounts[status.crop.id] = (cropIdCounts[status.crop.id] || 0) + 1;
      harvestedCropIds.push(status.crop.id);
      db.addItem(userId, 'crop', status.crop.id, 1);
      db.clearPlot(userId, plot.plot_index);

      // Bonus yield — chance for +1 extra crop per plot
      if (bonusYieldChance > 0 && Math.random() < bonusYieldChance) {
        cropCounts[status.crop.name] += 1;
        cropIdCounts[status.crop.id] = (cropIdCounts[status.crop.id] || 0) + 1;
        db.addItem(userId, 'crop', status.crop.id, 1);
        bonusYieldCount += 1;
      }

      const shearsBonusChance = equipped.shears
        ? SHEARS_BONUS_CHANCE_BASE + getEffectiveShears(equipped.shears)
        : 0;
      if (Math.random() < shearsBonusChance) {
        totalPayout += Math.round(status.crop.sellValue * 0.5);
      }

      if (currentToolCount + toolDrops.length < MAX_TOOLS && Math.random() < TOOL_DROP_CHANCE + toolFindBonus) {
        const toolTypeIds = Object.keys(TOOL_TYPES);
        const toolType = toolTypeIds[Math.floor(Math.random() * toolTypeIds.length)];
        const rarity = rollRarity();
        const stats = rollStats(toolType, rarity);
        db.addTool(userId, toolType, rarity, stats);
        toolDrops.push(`${RARITY_CIRCLE[rarity] || '⚪'} ${TOOL_TYPES[toolType].emoji} ${rarity} ${TOOL_TYPES[toolType].name}`);
      }

      const cropExp = (EXP_PER_RARITY[status.crop.rarity] || 1) + bonusExpPerCrop;
      for (const entry of Object.values(expTracker)) {
        const xpBoost = getEffectiveXpBoost(entry.toolRow);
        entry.expAdded += cropExp + xpBoost;
      }
    }

    // Coin bonus — flat % added to total before bumper
    if (coinBonusTotal > 0) totalPayout = Math.round(totalPayout * (1 + coinBonusTotal));
    if (bumperBoost) totalPayout = Math.round(totalPayout * bumperBoost.value);

    // Double drop — chance to double all crops + coins
    let isDoubled = false;
    if (doubleDropChance > 0 && Math.random() < doubleDropChance) {
      isDoubled = true;
      for (const [cropId, count] of Object.entries(cropIdCounts)) {
        db.addItem(userId, 'crop', cropId, count);
        const crop = getCrop(cropId);
        if (crop) cropCounts[crop.name] = (cropCounts[crop.name] || 0) + count;
      }
      totalPayout = Math.round(totalPayout * 2);
    }

    // Seed return — chance to get a seed back per harvested plot
    const seedsReturned = {};
    if (seedReturnChance > 0) {
      for (const cropId of harvestedCropIds) {
        if (Math.random() < seedReturnChance) {
          seedsReturned[cropId] = (seedsReturned[cropId] || 0) + 1;
          db.addItem(userId, 'seed', cropId, 1);
        }
      }
    }

    db.addCurrency(userId, totalPayout);
    db.consumeBoostCharges(userId);
    db.addLifetimeStats(userId, {
      gold: totalPayout,
      crops: targets.length,
      goldens: goldenCount,
      toolDrops: toolDrops.length,
    });

    const newAchievements = db.checkAndAwardAchievements(userId);

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

    const earningsLine = [
      `Earned **${totalPayout}** coins`,
      goldenCount ? `(${goldenCount} golden! ✨)` : null,
      bumperBoost ? '⚡ (Bumper Crop!)' : null,
      coinBonusTotal > 0 ? `🪙 (+${Math.round(coinBonusTotal * 100)}% coin bonus)` : null,
    ].filter(Boolean).join(' ');

    const lines = [
      `Harvested: ${cropSummary}${bonusYieldCount ? ` (+${bonusYieldCount} bonus yield 🌾)` : ''}`,
      earningsLine,
    ];
    if (isDoubled) lines.push('✨ **Double Drop!** Crops and coins doubled!');
    if (toolDrops.length) lines.push(`Found a tool: ${toolDrops.join(', ')}`);
    if (Object.keys(seedsReturned).length) {
      const seedList = Object.entries(seedsReturned)
        .map(([id, n]) => `${n}x ${getCrop(id)?.name || id} seed`)
        .join(', ');
      lines.push(`🌱 Seeds returned: ${seedList}`);
    }
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
