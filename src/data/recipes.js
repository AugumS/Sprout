const RECIPES = {
  golden_fertilizer: {
    id: 'golden_fertilizer',
    name: 'Golden Fertilizer',
    emoji: '🌿',
    description: '+15% golden chance for your next 5 harvests',
    ingredients: [
      { cropId: 'carrot',  amount: 10 },
      { cropId: 'tomato',  amount: 5  },
    ],
    boost: { type: 'golden', value: 0.15, charges: 5 },
  },
  growth_tonic: {
    id: 'growth_tonic',
    name: 'Growth Tonic',
    emoji: '💧',
    description: '−25% grow time for 2 hours',
    ingredients: [
      { cropId: 'pumpkin',   amount: 5 },
      { cropId: 'sunflower', amount: 3 },
    ],
    boost: { type: 'grow', value: 0.25, durationHours: 2 },
  },
  harvest_elixir: {
    id: 'harvest_elixir',
    name: 'Harvest Elixir',
    emoji: '🧪',
    description: '+30% yield for your next 5 harvests',
    ingredients: [
      { cropId: 'moonpetal', amount: 5 },
    ],
    boost: { type: 'yield', value: 0.30, charges: 5 },
  },
  lucky_charm: {
    id: 'lucky_charm',
    name: 'Lucky Charm',
    emoji: '🍀',
    description: '+15% tool find chance for your next 8 harvests',
    ingredients: [
      { cropId: 'glimmerroot', amount: 3 },
    ],
    boost: { type: 'tool_find', value: 0.15, charges: 8 },
  },
  bumper_crop: {
    id: 'bumper_crop',
    name: 'Bumper Crop',
    emoji: '⚡',
    description: 'Doubles payout on your very next harvest',
    ingredients: [
      { cropId: 'carrot',  amount: 5 },
      { cropId: 'tomato',  amount: 5 },
      { cropId: 'pumpkin', amount: 3 },
    ],
    boost: { type: 'bumper', value: 2.0, charges: 1 },
  },
};

const UPGRADES = {
  composter: {
    id: 'composter',
    name: 'Composter',
    emoji: '🪱',
    description: '+1 tool EXP per crop harvested per level',
    maxLevel: 3,
    costs: [
      { coins: 500,  crops: [{ cropId: 'carrot', amount: 15 }, { cropId: 'tomato', amount: 10 }] },
      { coins: 2000, crops: [{ cropId: 'pumpkin', amount: 8 }, { cropId: 'sunflower', amount: 5 }] },
      { coins: 6000, crops: [{ cropId: 'moonpetal', amount: 5 }, { cropId: 'glimmerroot', amount: 2 }] },
    ],
  },
  scarecrow: {
    id: 'scarecrow',
    name: 'Scarecrow',
    emoji: '🪆',
    description: '−10% seed purchase price per level',
    maxLevel: 3,
    costs: [
      { coins: 400,  crops: [{ cropId: 'carrot', amount: 20 }] },
      { coins: 1500, crops: [{ cropId: 'tomato', amount: 10 }, { cropId: 'pumpkin', amount: 5 }] },
      { coins: 5000, crops: [{ cropId: 'sunflower', amount: 8 }, { cropId: 'moonpetal', amount: 3 }] },
    ],
  },
  greenhouse: {
    id: 'greenhouse',
    name: 'Greenhouse',
    emoji: '🌡️',
    description: '−5% grow time for all crops per level',
    maxLevel: 3,
    costs: [
      { coins: 600,  crops: [{ cropId: 'carrot', amount: 20 }, { cropId: 'tomato', amount: 10 }] },
      { coins: 2500, crops: [{ cropId: 'pumpkin', amount: 10 }, { cropId: 'sunflower', amount: 8 }] },
      { coins: 8000, crops: [{ cropId: 'moonpetal', amount: 8 }, { cropId: 'glimmerroot', amount: 3 }] },
    ],
  },
};

function getRecipe(id) { return RECIPES[id] || null; }
function listRecipes() { return Object.values(RECIPES); }
function getUpgrade(id) { return UPGRADES[id] || null; }
function listUpgrades() { return Object.values(UPGRADES); }

module.exports = { RECIPES, UPGRADES, getRecipe, listRecipes, getUpgrade, listUpgrades };
