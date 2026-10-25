const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../db');
const { listCrops, getCrop } = require('../data/crops');
const { listToolTypes, getToolType, RARITY_ORDER, RARITY_CIRCLE } = require('../data/tools');
const { rollStats } = require('../data/stats');

const DEV_USER_ID = '559907908364795914';

function isDevUser(interaction) {
  return interaction.user.id === DEV_USER_ID;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dev')
    .setDescription('[Dev only] Testing and debugging commands.')
    .addSubcommand((sub) =>
      sub
        .setName('coins')
        .setDescription('Add (or subtract) coins from a user\'s balance.')
        .addIntegerOption((o) =>
          o.setName('amount').setDescription('Amount to add (use negative to subtract)').setRequired(true)
        )
        .addStringOption((o) =>
          o.setName('user_id').setDescription('Target user ID (defaults to yourself)')
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('seed')
        .setDescription('Give seeds to a user.')
        .addStringOption((o) =>
          o.setName('crop').setDescription('Which crop').setRequired(true)
            .addChoices(...listCrops().map((c) => ({ name: c.name, value: c.id })))
        )
        .addIntegerOption((o) =>
          o.setName('amount').setDescription('How many (default 10)').setMinValue(1)
        )
        .addStringOption((o) =>
          o.setName('user_id').setDescription('Target user ID (defaults to yourself)')
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('tool')
        .setDescription('Give a tool to a user.')
        .addStringOption((o) =>
          o.setName('type').setDescription('Tool type').setRequired(true)
            .addChoices(...listToolTypes().map((t) => ({ name: t.name, value: t.id })))
        )
        .addStringOption((o) =>
          o.setName('rarity').setDescription('Rarity').setRequired(true)
            .addChoices(...RARITY_ORDER.map((r) => ({ name: r, value: r })))
        )
        .addStringOption((o) =>
          o.setName('user_id').setDescription('Target user ID (defaults to yourself)')
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('ready')
        .setDescription('Instantly ripen all crops currently growing in your garden.')
    )
    .addSubcommand((sub) =>
      sub
        .setName('reset')
        .setDescription('Wipe your account completely (coins, plots, inventory).')
    )
    .addSubcommand((sub) =>
      sub
        .setName('craft')
        .setDescription('Give a tool with exact stat values to a user.')
        .addStringOption((o) =>
          o.setName('type').setDescription('Tool type').setRequired(true)
            .addChoices(...listToolTypes().map((t) => ({ name: t.name, value: t.id })))
        )
        .addStringOption((o) =>
          o.setName('rarity').setDescription('Rarity').setRequired(true)
            .addChoices(...RARITY_ORDER.map((r) => ({ name: r, value: r })))
        )
        .addStringOption((o) =>
          o.setName('user_id').setDescription('Target user ID (defaults to yourself)')
        )
        .addIntegerOption((o) =>
          o.setName('grow_reduction').setDescription('Grow Reduction % (hoe primary)').setMinValue(1).setMaxValue(100)
        )
        .addIntegerOption((o) =>
          o.setName('yield_bonus').setDescription('Yield Bonus % (watering can primary)').setMinValue(1).setMaxValue(100)
        )
        .addIntegerOption((o) =>
          o.setName('shears_bonus').setDescription('Harvest Bonus % (shears primary)').setMinValue(1).setMaxValue(100)
        )
        .addIntegerOption((o) =>
          o.setName('golden_chance').setDescription('Golden Chance % (secondary)').setMinValue(1).setMaxValue(100)
        )
        .addIntegerOption((o) =>
          o.setName('tool_find').setDescription('Tool Find % (secondary)').setMinValue(1).setMaxValue(100)
        )
        .addIntegerOption((o) =>
          o.setName('bonus_yield').setDescription('Bonus Yield % chance per plot (secondary)').setMinValue(1).setMaxValue(100)
        )
        .addIntegerOption((o) =>
          o.setName('xp_boost').setDescription('XP Boost flat bonus EXP per use (secondary)').setMinValue(1).setMaxValue(500)
        )
        .addIntegerOption((o) =>
          o.setName('coin_bonus').setDescription('Coin Bonus % added to total coins (secondary)').setMinValue(1).setMaxValue(100)
        )
        .addIntegerOption((o) =>
          o.setName('seed_return').setDescription('Seed Return % chance per plot (secondary)').setMinValue(1).setMaxValue(100)
        )
        .addIntegerOption((o) =>
          o.setName('double_drop').setDescription('Double Drop % chance (secondary, max effective 5)').setMinValue(1).setMaxValue(5)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('gate')
        .setDescription('Lock all channels behind @Farmer and post the ✅ rules message in #rules.')
    )
    .addSubcommand((sub) =>
      sub
        .setName('inspect')
        .setDescription('Dump raw DB state for a user.')
        .addStringOption((o) =>
          o.setName('user_id').setDescription('Discord user ID (defaults to yourself)')
        )
    ),

  async execute(interaction) {
    if (!isDevUser(interaction)) {
      await interaction.reply({ content: 'This command is for the developer only.', ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const selfId = interaction.user.id;

    if (sub === 'coins') {
      const amount = interaction.options.getInteger('amount', true);
      const targetId = interaction.options.getString('user_id') || selfId;
      db.getOrCreateUser(targetId);
      const newBalance = db.addCurrency(targetId, amount);
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setDescription(`${amount >= 0 ? '+' : ''}${amount} coins → \`${targetId}\`. New balance: **${newBalance}**.`)
          .setColor(0xd98e04)],
        ephemeral: true,
      });
      return;
    }

    if (sub === 'seed') {
      const cropId = interaction.options.getString('crop', true);
      const amount = interaction.options.getInteger('amount') || 10;
      const targetId = interaction.options.getString('user_id') || selfId;
      const crop = getCrop(cropId);
      db.getOrCreateUser(targetId);
      db.addItem(targetId, 'seed', cropId, amount);
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setDescription(`Gave ${amount}x ${crop.emoji} **${crop.name}** seed${amount > 1 ? 's' : ''} to \`${targetId}\`.`)
          .setColor(0x57b86a)],
        ephemeral: true,
      });
      return;
    }

    if (sub === 'tool') {
      const toolTypeId = interaction.options.getString('type', true);
      const rarity = interaction.options.getString('rarity', true);
      const targetId = interaction.options.getString('user_id') || selfId;
      const type = getToolType(toolTypeId);
      const stats = rollStats(toolTypeId, rarity);
      db.getOrCreateUser(targetId);
      const toolId = db.addTool(targetId, toolTypeId, rarity, stats);
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setDescription(`Gave ${RARITY_CIRCLE[rarity] || '⚪'} ${type.emoji} **${rarity} ${type.name}** (ID: \`#${toolId}\`) to \`${targetId}\`.`)
          .setColor(0x4a90d9)],
        ephemeral: true,
      });
      return;
    }

    if (sub === 'ready') {
      db.forceReadyPlots(selfId);
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setDescription('All growing crops are now ready to harvest.')
          .setColor(0x57b86a)],
        ephemeral: true,
      });
      return;
    }

    if (sub === 'reset') {
      db.resetUser(selfId);
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setDescription('Account wiped. You start fresh next time you run a command.')
          .setColor(0xe74c3c)],
        ephemeral: true,
      });
      return;
    }

    if (sub === 'craft') {
      const toolTypeId = interaction.options.getString('type', true);
      const rarity     = interaction.options.getString('rarity', true);
      const targetId   = interaction.options.getString('user_id') || selfId;
      const type       = getToolType(toolTypeId);

      const statKeys = ['grow_reduction', 'yield_bonus', 'shears_bonus', 'golden_chance', 'tool_find', 'bonus_yield', 'xp_boost', 'coin_bonus', 'seed_return', 'double_drop'];
      const stats = {};
      for (const key of statKeys) {
        const val = interaction.options.getInteger(key);
        if (val !== null) stats[key] = val;
      }

      if (Object.keys(stats).length === 0) {
        await interaction.reply({ content: 'Specify at least one stat value.', ephemeral: true });
        return;
      }

      db.getOrCreateUser(targetId);
      const toolId = db.addTool(targetId, toolTypeId, rarity, stats);
      const statSummary = Object.entries(stats).map(([k, v]) => `${k}: **${v}%**`).join(', ');

      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setDescription(`Crafted ${RARITY_CIRCLE[rarity] || '⚪'} ${type.emoji} **${rarity} ${type.name}** \`#${toolId}\` → \`${targetId}\`\n${statSummary}`)
          .setColor(0xa855f7)],
        ephemeral: true,
      });
      return;
    }

    if (sub === 'gate') {
      await interaction.deferReply({ ephemeral: true });

      const guild = interaction.guild;
      const everyoneRole = guild.roles.everyone;
      const farmerRole = guild.roles.cache.find((r) => r.name === 'Farmer');

      if (!farmerRole) {
        await interaction.editReply('Could not find @Farmer role. Run `/dev setup` first.');
        return;
      }

      // Strip ViewChannel from @everyone's base permissions
      const currentPerms = everyoneRole.permissions;
      await everyoneRole.setPermissions(
        currentPerms.remove([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])
      );

      const channels = await guild.channels.fetch();
      let rulesChannel = null;
      let updated = 0;

      for (const [, ch] of channels) {
        if (!ch) continue;

        if (ch.name === 'rules') {
          rulesChannel = ch;
          // Rules: @everyone can see, read-only
          await ch.permissionOverwrites.edit(everyoneRole.id, {
            ViewChannel: true,
            SendMessages: false,
            AddReactions: true,
            ReadMessageHistory: true,
          });
        } else if (ch.type === ChannelType.GuildCategory) {
          // Categories: deny @everyone, allow @Farmer
          await ch.permissionOverwrites.edit(everyoneRole.id, { ViewChannel: false });
          await ch.permissionOverwrites.edit(farmerRole.id, { ViewChannel: true, Connect: true, Speak: true });
        } else {
          // Text/voice channels: let category overwrites cascade
          await ch.permissionOverwrites.edit(everyoneRole.id, { ViewChannel: false });
          await ch.permissionOverwrites.edit(farmerRole.id, { ViewChannel: true });
        }
        updated++;
      }

      // Post the rules + verification message
      if (rulesChannel) {
        const msgs = await rulesChannel.messages.fetch({ limit: 10 });
        const existing = msgs.find((m) => m.author.id === guild.client.user.id && m.reactions.cache.has('✅'));
        if (!existing) {
          const rulesMsg = await rulesChannel.send({
            embeds: [new EmbedBuilder()
              .setTitle('📜 Server Rules')
              .setDescription([
                '**1.** Be respectful to all members.',
                '**2.** No spam, self-promotion, or excessive pinging.',
                '**3.** Keep discussions in the appropriate channels.',
                '**4.** No NSFW content of any kind.',
                '**5.** Follow Discord\'s [Terms of Service](https://discord.com/terms).',
                '',
                '> React with ✅ below to agree to the rules and unlock the server.',
              ].join('\n'))
              .setColor(0x27ae60)
              .setFooter({ text: 'Welcome to Sprout 🌱' })],
          });
          await rulesMsg.react('✅');
        }
      }

      await interaction.editReply(
        `✅ Gate active — ${updated} channels locked behind @Farmer.\n` +
        `New members see only #rules until they react with ✅.`
      );
      return;
    }

    if (sub === 'inspect') {
      const targetId = interaction.options.getString('user_id') || selfId;
      const user = db.getOrCreateUser(targetId);
      const plots = db.getPlots(targetId);
      const seeds = db.getInventory(targetId, 'seed');
      const crops = db.getInventory(targetId, 'crop');
      const tools = db.getInventory(targetId, 'tool');
      const equipped = db.getEquipped(targetId);

      const plotLines = plots.map((p) =>
        `[${p.plot_index}] crop=${p.crop_id || 'null'} planted=${p.planted_at || 'null'}`
      );
      const seedLines = seeds.map((s) => `${s.item_id} x${s.quantity}`);
      const cropLines = crops.map((c) => `${c.item_id} x${c.quantity}`);
      const toolLines = tools.map((t) => `[${t.id}] ${t.rarity} ${t.item_id}`);
      const equippedLines = [
        `hoe: ${equipped.hoe ? `[${equipped.hoe.id}] ${equipped.hoe.rarity}` : 'none'}`,
        `wateringcan: ${equipped.wateringcan ? `[${equipped.wateringcan.id}] ${equipped.wateringcan.rarity}` : 'none'}`,
        `shears: ${equipped.shears ? `[${equipped.shears.id}] ${equipped.shears.rarity}` : 'none'}`,
      ];

      const embed = new EmbedBuilder()
        .setTitle(`🔍 Inspect: ${targetId}`)
        .setColor(0x888888)
        .addFields(
          { name: 'Account', value: `Coins: **${user.currency}** | Plots: **${user.plot_count}**`, inline: false },
          { name: `Plots (${plots.length})`, value: plotLines.length ? `\`\`\`\n${plotLines.join('\n')}\n\`\`\`` : '*none*', inline: false },
          { name: `Seeds (${seeds.length} types)`, value: seedLines.length ? seedLines.join(', ') : '*none*', inline: false },
          { name: `Crops (${crops.length} types)`, value: cropLines.length ? cropLines.join(', ') : '*none*', inline: false },
          { name: `Tools (${tools.length})`, value: toolLines.length ? `\`\`\`\n${toolLines.slice(0, 20).join('\n')}${tools.length > 20 ? `\n... +${tools.length - 20} more` : ''}\n\`\`\`` : '*none*', inline: false },
          { name: 'Equipped', value: equippedLines.join('\n'), inline: false },
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }
  },
};
