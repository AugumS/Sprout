const ACHIEVEMENTS = {
  first_harvest:  { id: 'first_harvest',  name: 'Green Thumb',     emoji: '🌱', description: 'Harvest your first crop' },
  first_golden:   { id: 'first_golden',   name: 'Golden Touch',    emoji: '✨', description: 'Get your first golden harvest' },
  first_mythic:   { id: 'first_mythic',   name: 'Legend',          emoji: '🟠', description: 'Obtain a Legendary tool' },
  first_ultra:    { id: 'first_ultra',    name: 'Beyond Legend',   emoji: '🔴', description: 'Obtain an Ultra tool' },
  crops_100:      { id: 'crops_100',      name: 'Prolific Farmer', emoji: '🌾', description: 'Harvest 100 total crops' },
  crops_1000:     { id: 'crops_1000',     name: 'Master Farmer',   emoji: '🏆', description: 'Harvest 1,000 total crops' },
  gold_1000:      { id: 'gold_1000',      name: 'Prosperous',      emoji: '💰', description: 'Earn 1,000 total coins' },
  gold_10000:     { id: 'gold_10000',     name: 'Wealthy',         emoji: '💵', description: 'Earn 10,000 total coins' },
  gold_100000:    { id: 'gold_100000',    name: 'Tycoon',          emoji: '🤑', description: 'Earn 100,000 total coins' },
  upgrade_maxed:  { id: 'upgrade_maxed',  name: 'Maximalist',      emoji: '🏗️', description: 'Max out any upgrade to level 3' },
  all_upgraded:   { id: 'all_upgraded',   name: 'Master Builder',  emoji: '⚙️', description: 'Max out all three upgrades' },
  daily_7:        { id: 'daily_7',        name: 'Dedicated',       emoji: '📅', description: 'Claim your daily reward 100 times' },
  tools_50:       { id: 'tools_50',       name: 'Tool Hoarder',    emoji: '🔍', description: 'Find 50 total tools' },
  full_garden:    { id: 'full_garden',    name: 'Overgrown',       emoji: '🪴', description: 'Fill all 25 plots at the same time' },
};

function getAchievement(id) { return ACHIEVEMENTS[id] || null; }
function listAchievements() { return Object.values(ACHIEVEMENTS); }

module.exports = { ACHIEVEMENTS, getAchievement, listAchievements };
