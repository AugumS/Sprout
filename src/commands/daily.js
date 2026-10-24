const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { listCrops } = require('../data/crops');
const { getAchievement } = require('../data/achievements');

const DAILY_COINS_MIN = 150;
const DAILY_COINS_MAX = 350;
const DAILY_SEED_CROPS = ['carrot', 'tomato'];
const DAILY_SEED_AMOUNT = 3;

function formatCountdown(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily reward (resets every 24 hours).'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const result = db.claimDaily(userId);

    if (!result.success) {
      const timeLeft = formatCountdown(result.remaining);
      await interaction.reply({
        content: `You already claimed your daily reward! Come back in **${timeLeft}**.`,
        ephemeral: true,
      });
      return;
    }

    const coins = Math.floor(Math.random() * (DAILY_COINS_MAX - DAILY_COINS_MIN + 1)) + DAILY_COINS_MIN;
    const seedCropId = DAILY_SEED_CROPS[Math.floor(Math.random() * DAILY_SEED_CROPS.length)];
    const crops = listCrops();
    const seedCrop = crops.find((c) => c.id === seedCropId);

    db.addCurrency(userId, coins);
    db.addItem(userId, 'seed', seedCropId, DAILY_SEED_AMOUNT);
    db.incrementDailyCount(userId);
    const newAchievements = db.checkAndAwardAchievements(userId);

    const lines = [
      `**+${coins} coins** added to your wallet.`,
      `**+${DAILY_SEED_AMOUNT}x ${seedCrop?.emoji} ${seedCrop?.name} seeds** added to your inventory.`,
      '',
      '*Come back tomorrow for another reward!*',
    ];
    if (newAchievements.length) {
      lines.push('', ...newAchievements.map((id) => {
        const a = getAchievement(id);
        return `🏆 Achievement unlocked: ${a?.emoji} **${a?.name}**`;
      }));
    }

    const embed = new EmbedBuilder()
      .setTitle('🎁 Daily Reward Claimed!')
      .setDescription(lines.join('\n'))
      .setColor(0xf2b705);

    await interaction.reply({ embeds: [embed] });
  },
};
