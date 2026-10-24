const { getBonus, RARITY_TIERS } = require('./tools');

const STAT_DEFS = {
  grow_reduction: { name: 'Grow Reduction', emoji: '⏱️', primary_for: 'hoe' },
  yield_bonus:    { name: 'Yield Bonus',    emoji: '💰', primary_for: 'wateringcan' },
  shears_bonus:   { name: 'Harvest Bonus',  emoji: '✂️', primary_for: 'shears' },
  golden_chance:  { name: 'Golden Chance',  emoji: '⭐' },
  tool_find:      { name: 'Tool Find',      emoji: '🔍' },
};

// Rolled primary stat range per rarity (percentage points)
const PRIMARY_RANGES = {
  Common:   [1,  5],
  Uncommon: [6,  15],
  Rare:     [16, 28],
  Epic:     [29, 42],
  Mythic:   [43, 60],
};

const SECONDARY_COUNT = {
  Common: 0, Uncommon: 1, Rare: 1, Epic: 2, Mythic: 3,
};

const MAX_LEVEL = 20;

const EXP_PER_RARITY = {
  Common: 2, Uncommon: 5, Rare: 12, Epic: 25, Mythic: 50,
};

// Cumulative EXP required to reach a given level
function expForLevel(level) {
  if (level <= 1) return 0;
  return Math.round(50 * Math.pow(level - 1, 2));
}

function expToLevel(totalExp) {
  let level = 1;
  while (level < MAX_LEVEL && totalExp >= expForLevel(level + 1)) level++;
  return level;
}

// EXP still needed to reach the next level (Infinity at max)
function expToNextLevel(totalExp) {
  const level = expToLevel(totalExp);
  if (level >= MAX_LEVEL) return Infinity;
  return expForLevel(level + 1) - totalExp;
}

// +0.5% primary stat per level above 1
function getLevelBonus(level) {
  return Math.max(0, level - 1) * 0.005;
}

// Returns [min, max] roll range for a given stat key on a specific tool type + rarity.
function getStatRange(statKey, toolTypeId, rarity) {
  const [pMin, pMax] = PRIMARY_RANGES[rarity] || [1, 5];
  const def = STAT_DEFS[statKey];
  if (!def) return null;
  if (def.primary_for === toolTypeId) return [pMin, pMax];
  // Secondary stat range
  const secMax = Math.max(1, Math.round(pMax * 0.45));
  return [1, secMax];
}

function rollBetween(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

function rollStats(toolTypeId, rarity) {
  const [min, max] = PRIMARY_RANGES[rarity] || [1, 5];

  const primaryEntry = Object.entries(STAT_DEFS).find(([, v]) => v.primary_for === toolTypeId);
  const stats = {};

  if (primaryEntry) {
    stats[primaryEntry[0]] = rollBetween(min, max);
  }

  const secondaryCount = SECONDARY_COUNT[rarity] || 0;
  const pool = Object.entries(STAT_DEFS)
    .filter(([k, v]) => !v.primary_for || v.primary_for !== toolTypeId)
    .map(([k]) => k);

  for (let i = 0; i < secondaryCount && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    const key = pool.splice(idx, 1)[0];
    const secMax = Math.max(1, Math.round(max * 0.45));
    stats[key] = rollBetween(1, secMax);
  }

  return stats;
}

function formatStats(stats) {
  if (!stats) return [];
  return Object.entries(stats).map(([key, value]) => {
    const def = STAT_DEFS[key];
    if (!def) return null;
    return `${def.emoji} **${def.name}:** ${value}%`;
  }).filter(Boolean);
}

function _parsedStats(toolRow) {
  if (!toolRow || !toolRow.stats) return null;
  return typeof toolRow.stats === 'string' ? JSON.parse(toolRow.stats) : toolRow.stats;
}

// Returns decimal bonus (e.g. 0.25 for 25%) for a tool's primary stat,
// including the level bonus on top of the rolled base.
function getEffectivePrimary(toolRow) {
  if (!toolRow) return 0;
  const stats = _parsedStats(toolRow);
  let base = 0;
  if (stats) {
    const entry = Object.entries(STAT_DEFS).find(([, v]) => v.primary_for === toolRow.item_id);
    if (entry && stats[entry[0]] != null) base = stats[entry[0]] / 100;
  } else {
    base = getBonus(toolRow.rarity);
  }
  const level = expToLevel(toolRow.exp || 0);
  return base + getLevelBonus(level);
}

function getEffectiveShears(toolRow) {
  if (!toolRow) return 0;
  const stats = _parsedStats(toolRow);
  if (stats && stats.shears_bonus != null) return stats.shears_bonus / 100;
  return getBonus(toolRow.rarity);
}

function getEffectiveGolden(toolRow) {
  const stats = _parsedStats(toolRow);
  return stats ? (stats.golden_chance || 0) / 100 : 0;
}

function getEffectiveToolFind(toolRow) {
  const stats = _parsedStats(toolRow);
  return stats ? (stats.tool_find || 0) / 100 : 0;
}

function getToolSellValue(toolRow) {
  const base = Math.round((RARITY_TIERS[toolRow.rarity]?.shopPrice || 0) * 0.4);
  const level = expToLevel(toolRow.exp || 0);
  return Math.round(base * (1 + (level - 1) * 0.05));
}

module.exports = {
  STAT_DEFS,
  PRIMARY_RANGES,
  SECONDARY_COUNT,
  MAX_LEVEL,
  EXP_PER_RARITY,
  expForLevel,
  expToLevel,
  expToNextLevel,
  getLevelBonus,
  rollStats,
  getStatRange,
  formatStats,
  getEffectivePrimary,
  getEffectiveShears,
  getEffectiveGolden,
  getEffectiveToolFind,
  getToolSellValue,
};
