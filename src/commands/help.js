const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { listCrops } = require('../data/crops');
const { RARITY_TIERS } = require('../data/tools');

const TOPICS = ['overview', 'commands', 'crops', 'tools', 'stats'];

function overviewEmbed() {
  return new EmbedBuilder()
    .setTitle('🌱 Welcome to Farm Bot')
    .setDescription(
      'Farm Bot is a farming simulator — plant crops, harvest them for coins, collect rarity-tiered tools, and expand your garden.\n\n' +
      '**The core loop:**\n' +
      '1. `/buy seed` — spend coins on seeds\n' +
      '2. `/plant` — put a seed in an empty plot\n' +
      '3. Wait for the crop to grow (check `/garden` for timers)\n' +
      '4. `/harvest` — collect your crops and earn coins\n' +
      '5. Repeat — buy better seeds, find better tools, expand your garden\n\n' +
      '**Topics:** use `/help topic:` to dig deeper.\n' +
      '`commands` · `crops` · `tools` · `stats`'
    )
    .setColor(0x57b86a);
}

function commandsEmbed() {
  return new EmbedBuilder()
    .setTitle('📋 All Commands')
    .setColor(0x4a90d9)
    .addFields(
      {
        name: '🌾 Farming',
        value: [
          '`/garden` — view your plots and grow timers',
          '`/plant crop: [plot:]` — plant a seed; omit `plot` to use the first empty one',
          '`/plantall crop:` — fill all empty plots with the same crop',
          '`/harvest [plot:]` — harvest all ready crops, or one specific plot',
          '`/expand` — buy an extra plot (cost scales up each time)',
        ].join('\n'),
      },
      {
        name: '🛒 Shop & Inventory',
        value: [
          '`/shop` — browse seeds and tools for sale',
          '`/buy seed crop: [amount:]` — buy crop seeds',
          '`/buy tool type: rarity:` — buy a tool with rolled stats',
          '`/inventory [show:] [page:]` — view your coins, seeds, crops, and tools',
          '`/crops` — crop reference table with grow times, sell values, and coins/hr',
          '`/daily` — claim your daily reward (coins + seeds, resets every 24h)',
        ].join('\n'),
      },
      {
        name: '🔧 Tools',
        value: [
          '`/equip id:` — equip a tool by its ID (shown in `/inventory`)',
          '`/unequip slot:` — remove a tool from an equipment slot',
          '`/inspect id:` — view a tool\'s stat lines, level, and gold earned',
          '`/sell id:` — sell a single tool; `/sell allcrops` — sell all harvested crops',
          '`/sellall [max_rarity:] [rarity:] [type:]` — bulk-sell tools by filter',
        ].join('\n'),
      },
      {
        name: '✨ Boosts & Upgrades',
        value: [
          '`/craft list` — see craftable items with ✅/❌ ingredient status',
          '`/craft make item:` — craft a consumable',
          '`/use item:` — activate a consumable boost',
          '`/boosts` — view active boosts and consumables in inventory',
          '`/upgrade list` — view farm upgrades and costs',
          '`/upgrade buy type:` — purchase the next level of an upgrade',
        ].join('\n'),
      },
      {
        name: '👤 Profile',
        value: [
          '`/profile [user:]` — view your stats, equipped tools, and daily status',
          '`/achievements` — view earned and locked achievements',
          '`/help [topic:]` — this help system (topics: commands · crops · tools · stats)',
        ].join('\n'),
      },
    );
}

function cropsEmbed() {
  const crops = listCrops();
  const lines = crops.map((c) =>
    `${c.emoji} **${c.name}** (${c.rarity}) — ${c.seedPrice} coins · grows in ${c.growMinutes}m · sells for ${c.sellValue} · ${Math.round(c.goldenChance * 100)}% golden (${c.goldenMultiplier}×)`
  );

  return new EmbedBuilder()
    .setTitle('🌾 Crops')
    .setDescription(
      lines.join('\n') +
      '\n\n**Golden harvests:** a small chance per crop to multiply the payout. ' +
      'The ⭐ Golden Chance stat on tools increases this chance. ' +
      'Rarer crops have higher base golden chances and bigger multipliers.'
    )
    .setColor(0xf2b705);
}

function toolsEmbed() {
  const rarityLines = Object.entries(RARITY_TIERS).map(
    ([r, t]) => `**${r}** — ${t.shopPrice} coins · ${Math.round(t.bonus * 100)}% base bonus`
  );

  return new EmbedBuilder()
    .setTitle('🔧 Tools')
    .setColor(0xa855f7)
    .addFields(
      {
        name: 'Tool types',
        value: [
          '⛏️ **Hoe** — reduces how long crops take to grow',
          '🚿 **Watering Can** — increases coins earned per harvest',
          '✂️ **Shears** — chance to earn a bonus payout on each harvest',
        ].join('\n'),
      },
      {
        name: 'Rarities',
        value: rarityLines.join('\n'),
      },
      {
        name: 'Rolled stats',
        value:
          'Every tool rolls its own stats when obtained — two Epic Hoes can have different values. ' +
          'Common tools have no secondary stats; Mythic tools have three. ' +
          'Use `/inspect id:` to see a tool\'s exact rolls.',
      },
      {
        name: 'Levelling',
        value:
          'Equipped tools gain EXP every time you harvest (more EXP from rarer crops). ' +
          'Each level adds **+0.5%** to the tool\'s primary stat, up to Level 20 (+9.5%). ' +
          'Level-up announcements appear in your harvest results.',
      },
      {
        name: 'Finding tools',
        value:
          'Tools drop randomly from harvesting (5% base chance per crop). ' +
          'The 🔍 Tool Find secondary stat raises this chance. ' +
          'You can also buy specific rarities from the shop with `/buy tool`.',
      },
    );
}

function statsEmbed() {
  return new EmbedBuilder()
    .setTitle('📊 Stat Lines')
    .setDescription('Every tool rolls a **primary stat** and up to 3 **secondary stats** depending on rarity.')
    .setColor(0xd98e04)
    .addFields(
      {
        name: 'Primary stats (one per tool type)',
        value: [
          '⏱️ **Grow Reduction** *(Hoe)* — crops finish growing faster. 25% means a 60-min crop takes 45 min.',
          '💰 **Yield Bonus** *(Watering Can)* — increases coins per harvest. 25% on a 100-coin crop = 125 coins.',
          '✂️ **Harvest Bonus** *(Shears)* — chance of a bonus payout equal to 50% of the crop\'s sell value.',
        ].join('\n'),
      },
      {
        name: 'Secondary stats (any tool)',
        value: [
          '⭐ **Golden Chance** — adds to the golden harvest probability for each crop.',
          '🔍 **Tool Find** — adds to the chance a tool drops when you harvest.',
        ].join('\n'),
      },
      {
        name: 'Secondary stat ranges by rarity',
        value: [
          '**Common** — primary only (1–5%)',
          '**Uncommon** — primary + 1 secondary (primary 6–15%)',
          '**Rare** — primary + 1 secondary (primary 16–28%)',
          '**Epic** — primary + 2 secondaries (primary 29–42%)',
          '**Mythic** — primary + 3 secondaries (primary 43–60%)',
        ].join('\n'),
      },
      {
        name: 'Level bonus',
        value: 'Equipping and using a tool levels it up (max Level 20). Each level adds **+0.5%** to the primary stat on top of the rolled value.',
      },
    );
}

const EMBEDS = {
  overview: overviewEmbed,
  commands: commandsEmbed,
  crops: cropsEmbed,
  tools: toolsEmbed,
  stats: statsEmbed,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Learn how to play Farm Bot.')
    .addStringOption((o) =>
      o
        .setName('topic')
        .setDescription('Which topic to show (default: overview)')
        .addChoices(...TOPICS.map((t) => ({ name: t, value: t })))
    ),

  async execute(interaction) {
    const topic = interaction.options.getString('topic') || 'overview';
    const buildEmbed = EMBEDS[topic] || overviewEmbed;
    await interaction.reply({ embeds: [buildEmbed()], ephemeral: true });
  },
};
