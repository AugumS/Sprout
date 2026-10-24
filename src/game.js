const { getCrop } = require('./data/crops');
const { getEffectivePrimary } = require('./data/stats');

/**
 * Computes the live status of a single plot row from the database.
 * Returns one of three shapes: empty, growing, or ready.
 */
function plotStatus(plot, equippedHoe, extraGrowReduction = 0) {
  if (!plot.crop_id) {
    return { state: 'empty', plotIndex: plot.plot_index };
  }

  const crop = getCrop(plot.crop_id);
  if (!crop) {
    // Defensive: crop id in the database no longer exists in data/crops.js.
    return { state: 'empty', plotIndex: plot.plot_index };
  }

  const hoeReduction = getEffectivePrimary(equippedHoe);
  const totalReduction = Math.min(0.9, hoeReduction + extraGrowReduction);
  const effectiveGrowMs = crop.growMinutes * 60 * 1000 * (1 - totalReduction);
  const elapsedMs = Date.now() - plot.planted_at;
  const remainingMs = effectiveGrowMs - elapsedMs;

  if (remainingMs <= 0) {
    return { state: 'ready', plotIndex: plot.plot_index, crop };
  }

  return {
    state: 'growing',
    plotIndex: plot.plot_index,
    crop,
    remainingMs: Math.max(0, remainingMs),
  };
}

/**
 * Rolls the harvest payout for a crop: base sell value, a watering-can
 * yield bonus, and a small independent chance at a "golden" multiplier.
 */
function rollHarvest(crop, equippedWateringCan, goldenBonus = 0, extraYieldBonus = 0) {
  const yieldBonus = getEffectivePrimary(equippedWateringCan) + extraYieldBonus;
  const isGolden = Math.random() < (crop.goldenChance + goldenBonus);
  const multiplier = isGolden ? crop.goldenMultiplier : 1;
  const payout = Math.round(crop.sellValue * (1 + yieldBonus) * multiplier);
  return { payout, isGolden };
}

/** Cost in currency to add the next garden plot, scaling with how many you already have. */
function expandCost(currentPlotCount) {
  return Math.round(100 * Math.pow(currentPlotCount, 1.7));
}

function formatDuration(ms) {
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

module.exports = { plotStatus, rollHarvest, expandCost, formatDuration };
