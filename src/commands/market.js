const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../db');
const { TOOL_TYPES, RARITY_ORDER, RARITY_CIRCLE, listToolTypes } = require('../data/tools');
const { expToLevel } = require('../data/stats');

const STAT_DEFS = {
  grow_reduction: { emoji: '⏱️', label: 'Grow Reduction' },
  yield_bonus:    { emoji: '💰', label: 'Yield Bonus' },
  shears_bonus:   { emoji: '✂️', label: 'Harvest Bonus' },
  golden_chance:  { emoji: '⭐', label: 'Golden Chance' },
  tool_find:      { emoji: '🔍', label: 'Tool Find' },
};

function formatToolLine(row) {
  const type = TOOL_TYPES[row.item_id];
  const level = expToLevel(row.exp || 0);
  const circle = RARITY_CIRCLE[row.rarity] || '⚪';
  const stats = row.stats ? (typeof row.stats === 'string' ? JSON.parse(row.stats) : row.stats) : {};

  const statParts = Object.entries(stats).map(([key, val]) => {
    const def = STAT_DEFS[key];
    if (!def) return null;
    return `${def.emoji} ${def.label}: **${val}%**`;
  }).filter(Boolean);

  return {
    header: `${circle} ${type?.emoji} **${row.rarity} ${type?.name}** · Lv ${level}`,
    stats: statParts.join(' · ') || '*no stats rolled*',
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('market')
    .setDescription('Player-to-player tool marketplace.')
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('List one of your tools for sale.')
        .addIntegerOption((o) =>
          o.setName('id').setDescription('Tool ID from /inventory').setRequired(true).setMinValue(1)
        )
        .addIntegerOption((o) =>
          o.setName('price').setDescription('Asking price in coins').setRequired(true).setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('browse')
        .setDescription('Browse tool listings.')
        .addStringOption((o) =>
          o.setName('type').setDescription('Filter by tool type')
            .addChoices(...listToolTypes().map((t) => ({ name: t.name, value: t.id })))
        )
        .addStringOption((o) =>
          o.setName('rarity').setDescription('Filter by rarity')
            .addChoices(...RARITY_ORDER.map((r) => ({ name: r, value: r })))
        )
        .addIntegerOption((o) => o.setName('max_price').setDescription('Maximum price').setMinValue(1))
        .addIntegerOption((o) => o.setName('min_price').setDescription('Minimum price').setMinValue(1))
        .addIntegerOption((o) => o.setName('page').setDescription('Page number').setMinValue(1))
    )
    .addSubcommand((sub) =>
      sub
        .setName('buy')
        .setDescription('Buy a listing from the market.')
        .addIntegerOption((o) =>
          o.setName('listing_id').setDescription('Listing ID shown in /market browse').setRequired(true).setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('cancel')
        .setDescription('Remove one of your own listings.')
        .addIntegerOption((o) =>
          o.setName('listing_id').setDescription('Listing ID from /market mine').setRequired(true).setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('mine').setDescription('View your active listings.')
    )
    .addSubcommand((sub) =>
      sub
        .setName('info')
        .setDescription('View full details on a specific listing.')
        .addIntegerOption((o) =>
          o.setName('listing_id').setDescription('Listing ID shown in /market browse').setRequired(true).setMinValue(1)
        )
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const sub = interaction.options.getSubcommand();

    // ---- list ----
    if (sub === 'list') {
      const toolId = interaction.options.getInteger('id', true);
      const price  = interaction.options.getInteger('price', true);

      const result = db.createListing(userId, toolId, price, interaction.user.username);

      const messages = {
        not_owned:      `You don't own a tool with ID \`#${toolId}\`.`,
        equipped:       `Unequip that tool first before listing it (\`/unequip\`).`,
        already_listed: `That tool is already on the market.`,
      };
      if (!result.ok) {
        await interaction.reply({ content: messages[result.reason] || 'Something went wrong.', ephemeral: true });
        return;
      }

      const tool = db.getToolById(toolId);
      const { header, stats } = formatToolLine(tool);
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('📦 Listed on the Market')
            .setDescription(`${header}\n${stats}\n\n**Price:** ${price.toLocaleString()} coins · **Listing ID:** \`#${result.listingId}\``)
            .setColor(0x57b86a)
            .setFooter({ text: 'Use /market cancel to remove it.' }),
        ],
        ephemeral: true,
      });
      return;
    }

    // ---- browse ----
    if (sub === 'browse') {
      const toolType  = interaction.options.getString('type')      || null;
      const rarity    = interaction.options.getString('rarity')    || null;
      const maxPrice  = interaction.options.getInteger('max_price') ?? null;
      const minPrice  = interaction.options.getInteger('min_price') ?? null;
      const page      = interaction.options.getInteger('page')     || 1;

      const { rows, total, pages } = db.getListings({ toolType, rarity, minPrice, maxPrice, page });

      if (total === 0) {
        await interaction.reply({ content: 'No listings match those filters.', ephemeral: true });
        return;
      }

      const lines = rows.map((row) => {
        const { header, stats } = formatToolLine(row);
        return `**\`#${row.id}\`** ${header}\n${stats}\n💰 **${row.price.toLocaleString()} coins**`;
      });

      const filterParts = [];
      if (toolType) filterParts.push(TOOL_TYPES[toolType]?.name);
      if (rarity)   filterParts.push(rarity);
      if (minPrice) filterParts.push(`≥${minPrice.toLocaleString()}`);
      if (maxPrice) filterParts.push(`≤${maxPrice.toLocaleString()}`);

      const embed = new EmbedBuilder()
        .setTitle(`🏪 Market${filterParts.length ? ` — ${filterParts.join(' · ')}` : ''}`)
        .setDescription(lines.join('\n\n'))
        .setColor(0x4a90d9)
        .setFooter({ text: `${total} listing${total !== 1 ? 's' : ''} · Page ${page}/${pages} · /market buy listing_id: to purchase` });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // ---- buy ----
    if (sub === 'buy') {
      const listingId = interaction.options.getInteger('listing_id', true);
      const result = db.buyListing(userId, listingId);

      const messages = {
        not_found:   `Listing \`#${listingId}\` doesn't exist — it may have already been sold or cancelled.`,
        own_listing: `You can't buy your own listing.`,
        unavailable: `That listing is no longer available.`,
        no_funds:    `Not enough coins — this listing costs **${result.price?.toLocaleString()}** coins.`,
      };
      if (!result.ok) {
        await interaction.reply({ content: messages[result.reason] || 'Something went wrong.', ephemeral: true });
        return;
      }

      const { header, stats } = formatToolLine(result.tool);
      const newAchievements = db.checkAndAwardAchievements(userId);
      const descLines = [
        `${header}\n${stats}`,
        `Paid **${result.listing.price.toLocaleString()} coins** to **${result.listing.seller_name}**.`,
        `Equip it with \`/equip id:${result.tool.id}\`.`,
      ];
      if (newAchievements.length) {
        const { getAchievement } = require('../data/achievements');
        descLines.push('', ...newAchievements.map((id) => {
          const a = getAchievement(id);
          return `🏆 Achievement unlocked: ${a?.emoji} **${a?.name}**`;
        }));
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('✅ Purchase Complete')
            .setDescription(descLines.join('\n'))
            .setColor(0xd98e04),
        ],
      });
      return;
    }

    // ---- cancel ----
    if (sub === 'cancel') {
      const listingId = interaction.options.getInteger('listing_id', true);
      const result = db.cancelListing(userId, listingId);

      if (!result.ok) {
        const msg = result.reason === 'not_found' ? `Listing \`#${listingId}\` not found.`
          : `That's not your listing.`;
        await interaction.reply({ content: msg, ephemeral: true });
        return;
      }

      await interaction.reply({
        content: `Listing \`#${listingId}\` removed. Your tool is back in your inventory.`,
        ephemeral: true,
      });
      return;
    }

    // ---- info ----
    if (sub === 'info') {
      const listingId = interaction.options.getInteger('listing_id', true);
      const full = db.getListingById(listingId);

      if (!full) {
        await interaction.reply({ content: `Listing \`#${listingId}\` not found.`, ephemeral: true });
        return;
      }

      const { header, stats } = formatToolLine(full);
      const age = Date.now() - full.listed_at;
      const hours = Math.floor(age / 3600000);
      const mins  = Math.floor((age % 3600000) / 60000);
      const listedAgo = hours > 0 ? `${hours}h ${mins}m ago` : `${mins}m ago`;

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`🔍 Listing #${listingId}`)
            .setDescription(`${header}\n${stats}`)
            .addFields(
              { name: '💰 Price', value: `${full.price.toLocaleString()} coins`, inline: true },
              { name: '🕐 Listed', value: listedAgo, inline: true },
            )
            .setColor(0x4a90d9)
            .setFooter({ text: `/market buy listing_id:${listingId} to purchase` }),
        ],
      });
      return;
    }

    // ---- mine ----
    if (sub === 'mine') {
      const listings = db.getMyListings(userId);

      if (listings.length === 0) {
        await interaction.reply({
          content: 'You have no active listings. Use `/market list` to sell a tool.',
          ephemeral: true,
        });
        return;
      }

      const lines = listings.map((row) => {
        const { header, stats } = formatToolLine(row);
        return `**\`#${row.id}\`** ${header}\n${stats}\n💰 **${row.price.toLocaleString()} coins**`;
      });

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('📦 Your Market Listings')
            .setDescription(lines.join('\n\n'))
            .setColor(0x888888)
            .setFooter({ text: 'Use /market cancel listing_id: to remove a listing.' }),
        ],
        ephemeral: true,
      });
    }
  },
};
