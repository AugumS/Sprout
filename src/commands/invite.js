const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../config');

const PERMISSIONS = '268537910';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Get the link to add Sprout to your server.'),

  async execute(interaction) {
    const url = `https://discord.com/oauth2/authorize?client_id=${config.clientId}&scope=bot+applications.commands&permissions=${PERMISSIONS}`;
    const embed = new EmbedBuilder()
      .setTitle('🌱 Add Sprout to your server')
      .setDescription(`[Click here to invite Sprout](${url})`)
      .setColor(0x58d68d);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
