const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');

const STATS = [
  { value: 'total_gold_earned',     name: 'Gold Earned',       emoji: '💰', format: (v) => `${(v || 0).toLocaleString()} coins` },
  { value: 'total_crops_harvested', name: 'Crops Harvested',   emoji: '🌾', format: (v) => `${(v || 0).toLocaleString()} crops` },
  { value: 'total_golden_harvests', name: 'Golden Harvests',   emoji: '✨', format: (v) => `${(v || 0).toLocaleString()}` },
  { value: 'total_tool_drops',      name: 'Tools Found',       emoji: '🔍', format: (v) => `${(v || 0).toLocaleString()} tools` },
  { value: 'currency',              name: 'Richest Farmers',   emoji: '💵', format: (v) => `${(v || 0).toLocaleString()} coins` },
  { value: 'plot_count',            name: 'Biggest Gardens',   emoji: '🪴', format: (v) => `${(v || 0)} plots` },
];

const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the top farmers.')
    .addStringOption((o) =>
      o
        .setName('stat')
        .setDescription('Which stat to rank by (default: gold earned)')
        .addChoices(...STATS.map((s) => ({ name: `${s.emoji} ${s.name}`, value: s.value })))
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const statKey = interaction.options.getString('stat') || 'total_gold_earned';
    const stat = STATS.find((s) => s.value === statKey) || STATS[0];

    const rows = db.getLeaderboard(statKey);

    if (rows.length === 0) {
      await interaction.editReply({ content: 'No players on the leaderboard yet.' });
      return;
    }

    // Fetch Discord usernames for each row
    const lines = await Promise.all(
      rows.map(async (row, i) => {
        let name;
        try {
          const user = await interaction.client.users.fetch(row.id);
          name = user.username;
        } catch {
          name = `<${row.id}>`;
        }
        const medal = MEDALS[i] || `**${i + 1}.**`;
        const value = stat.format(row[statKey]);
        return `${medal} **${name}** — ${value}`;
      })
    );

    const embed = new EmbedBuilder()
      .setTitle(`${stat.emoji} Leaderboard — ${stat.name}`)
      .setDescription(lines.join('\n'))
      .setColor(0xf2b705)
      .setFooter({ text: `Top ${rows.length} farmers` });

    await interaction.editReply({ embeds: [embed] });
  },
};
