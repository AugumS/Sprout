// Tools come in three types, each affecting a different part of the loop,
// and five rarity tiers that scale a single bonus percentage. Rarity is a
// property of the inventory stack (see src/db.js), not a separate item id,
// so "an Epic Hoe" and a "Common Hoe" share a type but differ in bonus.

const TOOL_TYPES = {
  hoe: {
    id: 'hoe',
    name: 'Hoe',
    emoji: '⛏️',
    effect: 'growTimeReduction',
    description: 'Reduces how long crops take to grow',
  },
  wateringcan: {
    id: 'wateringcan',
    name: 'Watering Can',
    emoji: '🚿',
    effect: 'yieldBonus',
    description: 'Increases currency earned per harvest',
  },
  shears: {
    id: 'shears',
    name: 'Shears',
    emoji: '✂️',
    effect: 'bonusHarvestChance',
    description: 'Chance to earn a small bonus payout on harvest',
  },
};

const RARITY_TIERS = {
  Common:    { bonus: 0,    shopPrice: 50,   dropWeight: 60  },
  Uncommon:  { bonus: 0.1,  shopPrice: 150,  dropWeight: 25  },
  Rare:      { bonus: 0.2,  shopPrice: 400,  dropWeight: 10  },
  Epic:      { bonus: 0.35, shopPrice: 900,  dropWeight: 4   },
  Legendary: { bonus: 0.5,  shopPrice: 2000, dropWeight: 1   },
  Ultra:     { bonus: 0.65, shopPrice: 5000, dropWeight: 0.5 },
};

const RARITY_ORDER = Object.keys(RARITY_TIERS);

const RARITY_CIRCLE = {
  Common:    '⚪',
  Uncommon:  '🟢',
  Rare:      '🔵',
  Epic:      '🟣',
  Legendary: '🟠',
  Ultra:     '🔴',
};

function getToolType(id) {
  return TOOL_TYPES[id] || null;
}

function listToolTypes() {
  return Object.values(TOOL_TYPES);
}

function getBonus(rarity) {
  const tier = RARITY_TIERS[rarity];
  return tier ? tier.bonus : 0;
}

function getShopPrice(rarity) {
  const tier = RARITY_TIERS[rarity];
  return tier ? tier.shopPrice : 0;
}

// Weighted random rarity pick, used for the small chance of a bonus tool
// drop on harvest. Returns a rarity name.
function rollRarity() {
  const total = RARITY_ORDER.reduce(
    (sum, rarity) => sum + RARITY_TIERS[rarity].dropWeight,
    0
  );
  let roll = Math.random() * total;
  for (const rarity of RARITY_ORDER) {
    roll -= RARITY_TIERS[rarity].dropWeight;
    if (roll <= 0) return rarity;
  }
  return RARITY_ORDER[0];
}

module.exports = {
  TOOL_TYPES,
  RARITY_TIERS,
  RARITY_ORDER,
  RARITY_CIRCLE,
  getToolType,
  listToolTypes,
  getBonus,
  getShopPrice,
  rollRarity,
};
