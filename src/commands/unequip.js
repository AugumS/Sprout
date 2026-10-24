const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');

const SLOTS = [
  { value: 'hoe',         label: 'Hoe',          emoji: '⛏️' },
  { value: 'wateringcan', label: 'Watering Can',  emoji: '🚿' },
  { value: 'shears',      label: 'Shears',        emoji: '✂️' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unequip')
    .setDescription('Remove a tool from an equipment slot.')
    .addStringOption((o) =>
      o
        .setName('slot')
        .setDescription('Which slot to clear')
        .setRequired(true)
        .addChoices(...SLOTS.map((s) => ({ name: `${s.emoji} ${s.label}`, value: s.value })))
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const slot = interaction.options.getString('slot', true);
    const slotInfo = SLOTS.find((s) => s.value === slot);

    const equipped = db.getEquipped(userId);
    if (!equipped[slot]) {
      await interaction.reply({
        content: `Nothing is equipped in the ${slotInfo.emoji} ${slotInfo.label} slot.`,
        ephemeral: true,
      });
      return;
    }

    db.unequipTool(userId, slot);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setDescription(`Unequipped ${slotInfo.emoji} **${slotInfo.label}** slot. You can equip a new tool with \`/equip\`.`)
          .setColor(0x4a90d9),
      ],
      ephemeral: true,
    });
  },
};
