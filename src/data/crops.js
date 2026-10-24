// Original crop definitions. Grow times are in minutes (real time, checked
// lazily when a player interacts with their garden — no background job
// needed for this MVP). Each crop has a small chance to yield a "golden"
// variant worth a multiple of the base sell value.

const CROPS = {
  carrot: {
    id: 'carrot',
    name: 'Carrot',
    emoji: '🥕',
    rarity: 'Common',
    seedPrice: 5,
    growMinutes: 10,
    sellValue: 6,
    goldenChance: 0.03,
    goldenMultiplier: 5,
  },
  tomato: {
    id: 'tomato',
    name: 'Tomato',
    emoji: '🍅',
    rarity: 'Common',
    seedPrice: 8,
    growMinutes: 20,
    sellValue: 14,
    goldenChance: 0.03,
    goldenMultiplier: 5,
  },
  pumpkin: {
    id: 'pumpkin',
    name: 'Pumpkin',
    emoji: '🎃',
    rarity: 'Uncommon',
    seedPrice: 20,
    growMinutes: 60,
    sellValue: 45,
    goldenChance: 0.04,
    goldenMultiplier: 6,
  },
  sunflower: {
    id: 'sunflower',
    name: 'Sunflower',
    emoji: '🌻',
    rarity: 'Uncommon',
    seedPrice: 25,
    growMinutes: 90,
    sellValue: 55,
    goldenChance: 0.04,
    goldenMultiplier: 6,
  },
  starbloom: {
    id: 'starbloom',
    name: 'Starbloom',
    emoji: '🌸',
    rarity: 'Rare',
    seedPrice: 40,
    growMinutes: 120,
    sellValue: 100,
    goldenChance: 0.05,
    goldenMultiplier: 8,
  },
  moonpetal: {
    id: 'moonpetal',
    name: 'Moonpetal Berry',
    emoji: '🫐',
    rarity: 'Rare',
    seedPrice: 60,
    growMinutes: 180,
    sellValue: 140,
    goldenChance: 0.06,
    goldenMultiplier: 8,
  },
  glimmerroot: {
    id: 'glimmerroot',
    name: 'Glimmerroot',
    emoji: '🪴',
    rarity: 'Epic',
    seedPrice: 150,
    growMinutes: 360,
    sellValue: 400,
    goldenChance: 0.08,
    goldenMultiplier: 10,
  },
};

const RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Epic', 'Mythic'];

function getCrop(id) {
  return CROPS[id] || null;
}

function listCrops() {
  return Object.values(CROPS).sort(
    (a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
  );
}

module.exports = { CROPS, RARITY_ORDER, getCrop, listCrops };
