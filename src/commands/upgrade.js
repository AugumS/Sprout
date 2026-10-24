const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { getCrop } = require('../data/crops');
const { listUpgrades, getUpgrade } = require('../data/recipes');
const { getAchievement } = require('../data/achievements');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('upgrade')
    .setDescription('Buy permanent farm upgrades.')
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('Show all upgrades and your current levels.')
    )
    .addSubcommand((sub) =>
      sub
        .setName('buy')
        .setDescription('Purchase the next level of an upgrade.')
        .addStringOption((o) =>
          o
            .setName('type')
            .setDescription('Which upgrade to buy')
            .setRequired(true)
            .addChoices(...listUpgrades().map((u) => ({ name: `${u.emoji} ${u.name}`, value: u.id })))
        )
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();
    const user = db.getOrCreateUser(userId);

    if (sub === 'list') {
      const cropInventory = db.getInventory(userId, 'crop');
      const lines = listUpgrades().map((u) => {
        const level = user[`upgrade_${u.id}`] || 0;
        const maxed = level >= u.maxLevel;
        const status = maxed ? '✅ MAX' : `Level ${level}/${u.maxLevel}`;
        let nextCost = '';
        if (!maxed) {
          const cost = u.costs[level];
          const coinOk = user.currency >= cost.coins;
          const coinStr = `${coinOk ? '✅' : '❌'} ${cost.coins.toLocaleString()} coins *(have ${user.currency.toLocaleString()})*`;
          const parts = [coinStr];
          if (cost.crops) {
            parts.push(...cost.crops.map((c) => {
              const have = cropInventory.find((s) => s.item_id === c.cropId)?.quantity || 0;
              const ok = have >= c.amount;
              return `${ok ? '✅' : '❌'} ${c.amount}x ${getCrop(c.cropId)?.emoji} ${getCrop(c.cropId)?.name} *(have ${have})*`;
            }));
          }
          nextCost = `\n  *Next level:* ${parts.join(' · ')}`;
        }
        return `${u.emoji} **${u.name}** (${status}) — ${u.description}${nextCost}`;
      });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🏗️ Farm Upgrades')
            .setDescription(lines.join('\n\n'))
            .setColor(0xa855f7)
            .setFooter({ text: 'Use /upgrade buy type: to purchase' }),
        ],
        ephemeral: true,
      });
      return;
    }

    if (sub === 'buy') {
      const upgradeId = interaction.options.getString('type', true);
      const upgrade = getUpgrade(upgradeId);
      const currentLevel = user[`upgrade_${upgradeId}`] || 0;

      if (currentLevel >= upgrade.maxLevel) {
        await interaction.reply({ content: `${upgrade.emoji} **${upgrade.name}** is already maxed out!`, ephemeral: true });
        return;
      }

      const cost = upgrade.costs[currentLevel];

      // Check coins
      if (user.currency < cost.coins) {
        await interaction.reply({
          content: `Not enough coins — this upgrade costs ${cost.coins.toLocaleString()} coins (you have ${user.currency.toLocaleString()}).`,
          ephemeral: true,
        });
        return;
      }

      // Check crop costs
      if (cost.crops) {
        const cropInventory = db.getInventory(userId, 'crop');
        const missing = [];
        for (const c of cost.crops) {
          const stack = cropInventory.find((s) => s.item_id === c.cropId);
          const have = stack ? stack.quantity : 0;
          if (have < c.amount) {
            const crop = getCrop(c.cropId);
            missing.push(`${crop?.emoji} **${crop?.name}**: need ${c.amount}, have ${have}`);
          }
        }
        if (missing.length) {
          await interaction.reply({ content: `Not enough crops:\n${missing.join('\n')}`, ephemeral: true });
          return;
        }
        for (const c of cost.crops) {
          db.removeItem(userId, 'crop', c.cropId, c.amount);
        }
      }

      db.addCurrency(userId, -cost.coins);
      const newLevel = currentLevel + 1;
      db.setUpgradeLevel(userId, upgradeId, newLevel);

      const maxed = newLevel >= upgrade.maxLevel;
      const newAchievements = db.checkAndAwardAchievements(userId);

      const descLines = [
        `${upgrade.emoji} **${upgrade.name}** upgraded to Level ${newLevel}${maxed ? ' (MAX)' : ''}!\n${upgrade.description}.`,
      ];
      if (newAchievements.length) {
        descLines.push('', ...newAchievements.map((id) => {
          const a = getAchievement(id);
          return `🏆 Achievement unlocked: ${a?.emoji} **${a?.name}**`;
        }));
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setDescription(descLines.join('\n'))
            .setColor(0xa855f7),
        ],
      });
    }
  },
};
