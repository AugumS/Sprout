const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(process.env.DATABASE_PATH || path.join(__dirname, '..', 'farm.sqlite'));
db.pragma('journal_mode = WAL');

try { db.exec(`ALTER TABLE inventory ADD COLUMN stats TEXT`); } catch (_) {}
try { db.exec(`ALTER TABLE inventory ADD COLUMN exp INTEGER DEFAULT 0`); } catch (_) {}
try { db.exec(`ALTER TABLE inventory ADD COLUMN gold_harvested INTEGER DEFAULT 0`); } catch (_) {}
try { db.exec(`ALTER TABLE users ADD COLUMN total_gold_earned INTEGER DEFAULT 0`); } catch (_) {}
try { db.exec(`ALTER TABLE users ADD COLUMN total_crops_harvested INTEGER DEFAULT 0`); } catch (_) {}
try { db.exec(`ALTER TABLE users ADD COLUMN total_golden_harvests INTEGER DEFAULT 0`); } catch (_) {}
try { db.exec(`ALTER TABLE users ADD COLUMN total_tool_drops INTEGER DEFAULT 0`); } catch (_) {}
try { db.exec(`ALTER TABLE users ADD COLUMN upgrade_composter INTEGER DEFAULT 0`); } catch (_) {}
try { db.exec(`ALTER TABLE users ADD COLUMN upgrade_scarecrow INTEGER DEFAULT 0`); } catch (_) {}
try { db.exec(`ALTER TABLE users ADD COLUMN upgrade_greenhouse INTEGER DEFAULT 0`); } catch (_) {}
try { db.exec(`ALTER TABLE users ADD COLUMN last_daily INTEGER`); } catch (_) {}
try { db.exec(`ALTER TABLE users ADD COLUMN daily_count INTEGER DEFAULT 0`); } catch (_) {}
try { db.exec(`ALTER TABLE users ADD COLUMN achievements TEXT`); } catch (_) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS market_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id TEXT NOT NULL,
    seller_name TEXT NOT NULL,
    tool_id INTEGER NOT NULL UNIQUE,
    price INTEGER NOT NULL,
    listed_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_market_seller ON market_listings (seller_id);
  CREATE INDEX IF NOT EXISTS idx_market_tool ON market_listings (tool_id);
`);

// Migrate global shop_stock to per-user schema if needed
try { db.exec(`SELECT user_id FROM shop_stock LIMIT 1`); } catch (_) {
  db.exec(`DROP TABLE IF EXISTS shop_stock`);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS shop_stock (
    user_id TEXT NOT NULL,
    slot INTEGER NOT NULL,
    tool_type TEXT NOT NULL,
    rarity TEXT NOT NULL,
    price INTEGER NOT NULL,
    sold INTEGER NOT NULL DEFAULT 0,
    refreshed_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, slot)
  );
  CREATE INDEX IF NOT EXISTS idx_shop_stock_user ON shop_stock (user_id);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS boosts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    boost_type TEXT NOT NULL,
    value REAL NOT NULL,
    charges INTEGER,
    expires_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_boosts_user ON boosts (user_id);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    currency INTEGER NOT NULL DEFAULT 250,
    plot_count INTEGER NOT NULL DEFAULT 3,
    premium_tier TEXT,
    equipped_hoe INTEGER,
    equipped_wateringcan INTEGER,
    equipped_shears INTEGER,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS plots (
    user_id TEXT NOT NULL,
    plot_index INTEGER NOT NULL,
    crop_id TEXT,
    planted_at INTEGER,
    PRIMARY KEY (user_id, plot_index)
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    item_type TEXT NOT NULL,
    item_id TEXT NOT NULL,
    rarity TEXT,
    quantity INTEGER NOT NULL DEFAULT 1
  );

  CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory (user_id, item_type);
`);

const STARTING_CURRENCY = 100;
const STARTING_PLOTS = 3;

// ---------- users ----------

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (id, currency, plot_count, created_at)
  VALUES (?, ?, ?, ?)
`);
const selectUser = db.prepare(`SELECT * FROM users WHERE id = ?`);

function getOrCreateUser(userId) {
  insertUser.run(userId, STARTING_CURRENCY, STARTING_PLOTS, Date.now());
  ensurePlots(userId);
  return selectUser.get(userId);
}

const updateCurrencyStmt = db.prepare(
  `UPDATE users SET currency = currency + ? WHERE id = ?`
);

function addCurrency(userId, amount) {
  updateCurrencyStmt.run(amount, userId);
  return selectUser.get(userId).currency;
}

function getCurrency(userId) {
  return getOrCreateUser(userId).currency;
}

const setPlotCountStmt = db.prepare(
  `UPDATE users SET plot_count = ? WHERE id = ?`
);

function expandGarden(userId) {
  const user = getOrCreateUser(userId);
  const newCount = user.plot_count + 1;
  setPlotCountStmt.run(newCount, userId);
  ensurePlots(userId);
  return newCount;
}

const setEquippedStmt = {
  hoe: db.prepare(`UPDATE users SET equipped_hoe = ? WHERE id = ?`),
  wateringcan: db.prepare(`UPDATE users SET equipped_wateringcan = ? WHERE id = ?`),
  shears: db.prepare(`UPDATE users SET equipped_shears = ? WHERE id = ?`),
};

function equipTool(userId, toolType, inventoryRowId) {
  if (!setEquippedStmt[toolType]) {
    throw new Error(`Unknown tool type: ${toolType}`);
  }
  setEquippedStmt[toolType].run(inventoryRowId, userId);
}

function getEquipped(userId) {
  const user = getOrCreateUser(userId);
  const getRow = db.prepare(`SELECT * FROM inventory WHERE id = ?`);
  return {
    hoe: user.equipped_hoe ? getRow.get(user.equipped_hoe) : null,
    wateringcan: user.equipped_wateringcan ? getRow.get(user.equipped_wateringcan) : null,
    shears: user.equipped_shears ? getRow.get(user.equipped_shears) : null,
  };
}

// ---------- plots ----------

const insertPlot = db.prepare(`
  INSERT OR IGNORE INTO plots (user_id, plot_index, crop_id, planted_at)
  VALUES (?, ?, NULL, NULL)
`);
const selectPlots = db.prepare(
  `SELECT * FROM plots WHERE user_id = ? ORDER BY plot_index ASC`
);

function ensurePlots(userId) {
  const user = selectUser.get(userId);
  const count = user ? user.plot_count : STARTING_PLOTS;
  for (let i = 0; i < count; i++) {
    insertPlot.run(userId, i);
  }
}

function getPlots(userId) {
  getOrCreateUser(userId);
  return selectPlots.all(userId);
}

const plantStmt = db.prepare(`
  UPDATE plots SET crop_id = ?, planted_at = ?
  WHERE user_id = ? AND plot_index = ? AND crop_id IS NULL
`);

function plantCrop(userId, plotIndex, cropId) {
  const result = plantStmt.run(cropId, Date.now(), userId, plotIndex);
  return result.changes > 0;
}

const clearPlotStmt = db.prepare(`
  UPDATE plots SET crop_id = NULL, planted_at = NULL
  WHERE user_id = ? AND plot_index = ?
`);

function clearPlot(userId, plotIndex) {
  clearPlotStmt.run(userId, plotIndex);
}

// ---------- inventory ----------

const selectStack = db.prepare(`
  SELECT * FROM inventory
  WHERE user_id = ? AND item_type = ? AND item_id = ? AND IFNULL(rarity, '') = IFNULL(?, '')
`);
const insertStack = db.prepare(`
  INSERT INTO inventory (user_id, item_type, item_id, rarity, quantity)
  VALUES (?, ?, ?, ?, ?)
`);
const insertToolWithStats = db.prepare(`
  INSERT INTO inventory (user_id, item_type, item_id, rarity, quantity, stats)
  VALUES (?, 'tool', ?, ?, 1, ?)
`);
const selectById = db.prepare(`SELECT * FROM inventory WHERE id = ?`);
const deleteById = db.prepare(`DELETE FROM inventory WHERE id = ? AND user_id = ?`);
const incrementStack = db.prepare(
  `UPDATE inventory SET quantity = quantity + ? WHERE id = ?`
);
const decrementStack = db.prepare(
  `UPDATE inventory SET quantity = quantity - ? WHERE id = ?`
);
const deleteStack = db.prepare(`DELETE FROM inventory WHERE id = ?`);

function addItem(userId, itemType, itemId, quantity = 1, rarity = null) {
  const existing = selectStack.get(userId, itemType, itemId, rarity);
  if (existing) {
    incrementStack.run(quantity, existing.id);
    return existing.id;
  }
  const result = insertStack.run(userId, itemType, itemId, rarity, quantity);
  return result.lastInsertRowid;
}

function removeItem(userId, itemType, itemId, quantity = 1, rarity = null) {
  const existing = selectStack.get(userId, itemType, itemId, rarity);
  if (!existing || existing.quantity < quantity) return false;
  if (existing.quantity === quantity) {
    deleteStack.run(existing.id);
  } else {
    decrementStack.run(quantity, existing.id);
  }
  return true;
}

const selectInventoryByType = db.prepare(`
  SELECT * FROM inventory WHERE user_id = ? AND item_type = ? ORDER BY item_id ASC
`);

function getInventory(userId, itemType) {
  getOrCreateUser(userId);
  return selectInventoryByType.all(userId, itemType);
}

function addTool(userId, toolTypeId, rarity, stats) {
  const statsJson = stats ? JSON.stringify(stats) : null;
  const result = insertToolWithStats.run(userId, toolTypeId, rarity, statsJson);
  return result.lastInsertRowid;
}

function getToolById(id) {
  return selectById.get(id) || null;
}

function removeTool(userId, toolId) {
  const result = deleteById.run(toolId, userId);
  return result.changes > 0;
}

const addToolExpStmt = db.prepare(`UPDATE inventory SET exp = exp + ? WHERE id = ?`);
const addToolGoldStmt = db.prepare(`UPDATE inventory SET gold_harvested = gold_harvested + ? WHERE id = ?`);

const addLifetimeStatsStmt = db.prepare(`
  UPDATE users SET
    total_gold_earned      = total_gold_earned      + @gold,
    total_crops_harvested  = total_crops_harvested  + @crops,
    total_golden_harvests  = total_golden_harvests  + @goldens,
    total_tool_drops       = total_tool_drops       + @toolDrops
  WHERE id = @userId
`);

function addLifetimeStats(userId, { gold = 0, crops = 0, goldens = 0, toolDrops = 0 }) {
  addLifetimeStatsStmt.run({ userId, gold, crops, goldens, toolDrops });
}

// ---------- boosts ----------

function getActiveBoosts(userId) {
  return db.prepare(`
    SELECT * FROM boosts
    WHERE user_id = ?
    AND (charges IS NULL OR charges > 0)
    AND (expires_at IS NULL OR expires_at > ?)
  `).all(userId, Date.now());
}

function addBoost(userId, boostType, value, charges, expiresAt) {
  db.prepare(
    `INSERT INTO boosts (user_id, boost_type, value, charges, expires_at) VALUES (?, ?, ?, ?, ?)`
  ).run(userId, boostType, value, charges ?? null, expiresAt ?? null);
}

function consumeBoostCharges(userId) {
  db.prepare(
    `UPDATE boosts SET charges = charges - 1 WHERE user_id = ? AND charges IS NOT NULL AND charges > 0`
  ).run(userId);
  db.prepare(
    `DELETE FROM boosts WHERE user_id = ? AND ((charges IS NOT NULL AND charges <= 0) OR (expires_at IS NOT NULL AND expires_at <= ?))`
  ).run(userId, Date.now());
}

// ---------- upgrades ----------

function getUpgradeLevel(userId, upgradeId) {
  const user = selectUser.get(userId);
  if (!user) return 0;
  return user[`upgrade_${upgradeId}`] || 0;
}

function setUpgradeLevel(userId, upgradeId, level) {
  db.prepare(`UPDATE users SET upgrade_${upgradeId} = ? WHERE id = ?`).run(level, userId);
}

function unequipTool(userId, toolType) {
  const cols = { hoe: 'equipped_hoe', wateringcan: 'equipped_wateringcan', shears: 'equipped_shears' };
  if (!cols[toolType]) throw new Error(`Unknown tool type: ${toolType}`);
  db.prepare(`UPDATE users SET ${cols[toolType]} = NULL WHERE id = ?`).run(userId);
}

function getAchievements(userId) {
  const user = selectUser.get(userId);
  if (!user || !user.achievements) return new Set();
  try { return new Set(JSON.parse(user.achievements)); } catch { return new Set(); }
}

function addAchievements(userId, newIds) {
  if (!newIds.length) return;
  const existing = getAchievements(userId);
  for (const id of newIds) existing.add(id);
  db.prepare(`UPDATE users SET achievements = ? WHERE id = ?`).run(JSON.stringify([...existing]), userId);
}

function checkAndAwardAchievements(userId) {
  const user = selectUser.get(userId);
  if (!user) return [];
  const earned = getAchievements(userId);
  const newIds = [];

  const checks = {
    first_harvest:  (u) => (u.total_crops_harvested || 0) >= 1,
    first_golden:   (u) => (u.total_golden_harvests || 0) >= 1,
    crops_100:      (u) => (u.total_crops_harvested || 0) >= 100,
    crops_1000:     (u) => (u.total_crops_harvested || 0) >= 1000,
    gold_1000:      (u) => (u.total_gold_earned || 0) >= 1000,
    gold_10000:     (u) => (u.total_gold_earned || 0) >= 10000,
    gold_100000:    (u) => (u.total_gold_earned || 0) >= 100000,
    upgrade_maxed:  (u) => (u.upgrade_composter >= 3 || u.upgrade_scarecrow >= 3 || u.upgrade_greenhouse >= 3),
    all_upgraded:   (u) => (u.upgrade_composter >= 3 && u.upgrade_scarecrow >= 3 && u.upgrade_greenhouse >= 3),
    daily_7:        (u) => (u.daily_count || 0) >= 100,
    tools_50:       (u) => (u.total_tool_drops || 0) >= 50,
  };

  for (const [id, check] of Object.entries(checks)) {
    if (!earned.has(id) && check(user)) newIds.push(id);
  }

  if (!earned.has('first_mythic')) {
    const hasMythic = db.prepare(
      `SELECT COUNT(*) as c FROM inventory WHERE user_id = ? AND item_type = 'tool' AND rarity = 'Mythic'`
    ).get(userId).c > 0;
    if (hasMythic) newIds.push('first_mythic');
  }

  if (!earned.has('full_garden')) {
    const plots = selectPlots.all(userId);
    if (plots.length >= 25 && plots.every((p) => p.crop_id)) newIds.push('full_garden');
  }

  if (newIds.length) addAchievements(userId, newIds);
  return newIds;
}

function incrementDailyCount(userId) {
  db.prepare(`UPDATE users SET daily_count = COALESCE(daily_count, 0) + 1 WHERE id = ?`).run(userId);
}

const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function claimDaily(userId) {
  const user = getOrCreateUser(userId);
  const now = Date.now();
  if (user.last_daily && now - user.last_daily < DAILY_COOLDOWN_MS) {
    return { success: false, remaining: DAILY_COOLDOWN_MS - (now - user.last_daily) };
  }
  db.prepare(`UPDATE users SET last_daily = ? WHERE id = ?`).run(now, userId);
  return { success: true };
}

function countTools(userId) {
  return db.prepare(`SELECT COUNT(*) as c FROM inventory WHERE user_id = ? AND item_type = 'tool'`).get(userId).c;
}

function getLatestTool(userId) {
  return db.prepare(
    `SELECT * FROM inventory WHERE user_id = ? AND item_type = 'tool' ORDER BY id DESC LIMIT 1`
  ).get(userId) || null;
}

function getToolsByFilter(userId, { itemTypeId = null, rarities = null } = {}) {
  let query = `SELECT * FROM inventory WHERE user_id = ? AND item_type = 'tool'`;
  const params = [userId];
  if (itemTypeId) { query += ` AND item_id = ?`; params.push(itemTypeId); }
  if (rarities && rarities.length) {
    query += ` AND rarity IN (${rarities.map(() => '?').join(',')})`;
    params.push(...rarities);
  }
  return db.prepare(query).all(...params);
}

const LEADERBOARD_COLUMNS = new Set([
  'total_gold_earned', 'total_crops_harvested', 'total_golden_harvests',
  'total_tool_drops', 'currency', 'plot_count',
]);

function getLeaderboard(column, limit = 10) {
  if (!LEADERBOARD_COLUMNS.has(column)) throw new Error(`Invalid leaderboard column: ${column}`);
  return db.prepare(`SELECT * FROM users ORDER BY ${column} DESC LIMIT ?`).all(limit);
}

function addToolExp(toolId, amount) {
  addToolExpStmt.run(amount, toolId);
}

function addToolGold(toolId, amount) {
  addToolGoldStmt.run(amount, toolId);
}

const forceReadyPlotsStmt = db.prepare(
  `UPDATE plots SET planted_at = 0 WHERE user_id = ? AND crop_id IS NOT NULL`
);

function forceReadyPlots(userId) {
  forceReadyPlotsStmt.run(userId);
}

// ---------- rotating tool shop ----------

const SHOP_SLOTS = 6;
const SHOP_REFRESH_MS = 8 * 60 * 60 * 1000; // 8 hours

const SHOP_RARITY_WEIGHTS = {
  Common:   45,
  Uncommon: 30,
  Rare:     16,
  Epic:      7,
  Mythic:    2,
};
const SHOP_RARITY_ORDER = ['Common', 'Uncommon', 'Rare', 'Epic', 'Mythic'];
const SHOP_RARITY_TOTAL = Object.values(SHOP_RARITY_WEIGHTS).reduce((a, b) => a + b, 0);

const RARITY_SHOP_PRICE = { Common: 50, Uncommon: 150, Rare: 400, Epic: 900, Mythic: 2000 };

function rollShopRarity() {
  let roll = Math.random() * SHOP_RARITY_TOTAL;
  for (const r of SHOP_RARITY_ORDER) {
    roll -= SHOP_RARITY_WEIGHTS[r];
    if (roll <= 0) return r;
  }
  return SHOP_RARITY_ORDER[0];
}

const TOOL_TYPE_IDS = ['hoe', 'wateringcan', 'shears'];

function generateShopStock(userId) {
  const now = Date.now();
  const insert = db.prepare(
    `INSERT OR REPLACE INTO shop_stock (user_id, slot, tool_type, rarity, price, sold, refreshed_at) VALUES (?, ?, ?, ?, ?, 0, ?)`
  );
  const gen = db.transaction(() => {
    for (let i = 0; i < SHOP_SLOTS; i++) {
      const rarity = rollShopRarity();
      const toolType = TOOL_TYPE_IDS[Math.floor(Math.random() * TOOL_TYPE_IDS.length)];
      const price = RARITY_SHOP_PRICE[rarity];
      insert.run(userId, i, toolType, rarity, price, now);
    }
  });
  gen();
}

function getShopStock(userId) {
  const rows = db.prepare(`SELECT * FROM shop_stock WHERE user_id = ? ORDER BY slot`).all(userId);
  if (rows.length === 0 || Date.now() - rows[0].refreshed_at >= SHOP_REFRESH_MS) {
    generateShopStock(userId);
    return db.prepare(`SELECT * FROM shop_stock WHERE user_id = ? ORDER BY slot`).all(userId);
  }
  return rows;
}

function shopNextRefresh(userId) {
  const row = db.prepare(`SELECT refreshed_at FROM shop_stock WHERE user_id = ? LIMIT 1`).get(userId);
  if (!row) return 0;
  return row.refreshed_at + SHOP_REFRESH_MS;
}

function buyShopSlot(userId, slot) {
  const row = db.prepare(`SELECT * FROM shop_stock WHERE user_id = ? AND slot = ?`).get(userId, slot);
  if (!row) return { ok: false, reason: 'invalid_slot' };
  if (row.sold) return { ok: false, reason: 'already_sold' };

  if (Date.now() - row.refreshed_at >= SHOP_REFRESH_MS) {
    generateShopStock(userId);
    return { ok: false, reason: 'refreshed' };
  }

  const user = selectUser.get(userId);
  if (!user || user.currency < row.price) return { ok: false, reason: 'no_funds', price: row.price };

  db.prepare(`UPDATE shop_stock SET sold = 1 WHERE user_id = ? AND slot = ?`).run(userId, slot);
  updateCurrencyStmt.run(-row.price, userId);
  return { ok: true, toolType: row.tool_type, rarity: row.rarity, price: row.price };
}

// ---------- player market ----------

function isToolListed(toolId) {
  return !!db.prepare(`SELECT id FROM market_listings WHERE tool_id = ?`).get(toolId);
}

function createListing(userId, toolId, price, sellerName) {
  const tool = db.prepare(`SELECT * FROM inventory WHERE id = ? AND user_id = ? AND item_type = 'tool'`).get(toolId, userId);
  if (!tool) return { ok: false, reason: 'not_owned' };

  const user = selectUser.get(userId);
  if ([user.equipped_hoe, user.equipped_wateringcan, user.equipped_shears].includes(toolId)) {
    return { ok: false, reason: 'equipped' };
  }

  if (isToolListed(toolId)) return { ok: false, reason: 'already_listed' };

  try {
    const escrow = db.transaction(() => {
      const row = db.prepare(
        `INSERT INTO market_listings (seller_id, seller_name, tool_id, price, listed_at) VALUES (?, ?, ?, ?, ?)`
      ).run(userId, sellerName, toolId, price, Date.now());
      // Move tool into escrow — vanishes from seller's inventory
      db.prepare(`UPDATE inventory SET user_id = '__market__' WHERE id = ?`).run(toolId);
      return row.lastInsertRowid;
    });
    return { ok: true, listingId: escrow() };
  } catch (e) {
    // UNIQUE constraint on tool_id fired — race condition
    return { ok: false, reason: 'already_listed' };
  }
}

function cancelListing(userId, listingId) {
  const listing = db.prepare(`SELECT * FROM market_listings WHERE id = ?`).get(listingId);
  if (!listing) return { ok: false, reason: 'not_found' };
  if (listing.seller_id !== userId) return { ok: false, reason: 'not_yours' };
  db.transaction(() => {
    db.prepare(`DELETE FROM market_listings WHERE id = ?`).run(listingId);
    // Return tool from escrow to seller
    db.prepare(`UPDATE inventory SET user_id = ? WHERE id = ?`).run(userId, listing.tool_id);
  })();
  return { ok: true };
}

function getMyListings(userId) {
  return db.prepare(
    `SELECT ml.*, inv.rarity, inv.item_id, inv.stats, inv.exp
     FROM market_listings ml
     JOIN inventory inv ON inv.id = ml.tool_id
     WHERE ml.seller_id = ?
     ORDER BY ml.listed_at DESC`
  ).all(userId);
}

const MARKET_PAGE_SIZE = 6;

function getListings({ toolType = null, rarity = null, minPrice = null, maxPrice = null, page = 1 } = {}) {
  let where = `WHERE 1=1`;
  const params = [];
  if (toolType)  { where += ` AND inv.item_id = ?`;       params.push(toolType); }
  if (rarity)    { where += ` AND inv.rarity = ?`;         params.push(rarity); }
  if (minPrice != null) { where += ` AND ml.price >= ?`;   params.push(minPrice); }
  if (maxPrice != null) { where += ` AND ml.price <= ?`;   params.push(maxPrice); }

  const base = `FROM market_listings ml JOIN inventory inv ON inv.id = ml.tool_id ${where}`;
  const total = db.prepare(`SELECT COUNT(*) as n ${base}`).get(...params).n;
  const offset = (page - 1) * MARKET_PAGE_SIZE;
  const rows = db.prepare(
    `SELECT ml.*, inv.rarity, inv.item_id, inv.stats, inv.exp ${base} ORDER BY ml.listed_at DESC LIMIT ? OFFSET ?`
  ).all(...params, MARKET_PAGE_SIZE, offset);
  return { rows, total, pages: Math.ceil(total / MARKET_PAGE_SIZE) };
}

function getListingById(listingId) {
  return db.prepare(
    `SELECT ml.*, inv.rarity, inv.item_id, inv.stats, inv.exp
     FROM market_listings ml
     JOIN inventory inv ON inv.id = ml.tool_id
     WHERE ml.id = ?`
  ).get(listingId) || null;
}

const buyListingTx = db.transaction((buyerId, listingId) => {
  const listing = db.prepare(`SELECT * FROM market_listings WHERE id = ?`).get(listingId);
  if (!listing) return { ok: false, reason: 'not_found' };
  if (listing.seller_id === buyerId) return { ok: false, reason: 'own_listing' };

  // Verify the tool still exists and belongs to the seller
  const tool = db.prepare(`SELECT * FROM inventory WHERE id = ? AND user_id = ?`).get(listing.tool_id, listing.seller_id);
  if (!tool) {
    db.prepare(`DELETE FROM market_listings WHERE id = ?`).run(listingId);
    return { ok: false, reason: 'unavailable' };
  }

  const buyer = db.prepare(`SELECT * FROM users WHERE id = ?`).get(buyerId);
  if (!buyer || buyer.currency < listing.price) return { ok: false, reason: 'no_funds', price: listing.price };

  db.prepare(`DELETE FROM market_listings WHERE id = ?`).run(listingId);
  db.prepare(`UPDATE inventory SET user_id = ? WHERE id = ?`).run(buyerId, listing.tool_id);
  db.prepare(`UPDATE users SET currency = currency - ? WHERE id = ?`).run(listing.price, buyerId);
  db.prepare(`UPDATE users SET currency = currency + ? WHERE id = ?`).run(listing.price, listing.seller_id);

  return { ok: true, tool, listing };
});

function buyListing(buyerId, listingId) {
  return buyListingTx(buyerId, listingId);
}

function resetUser(userId) {
  db.prepare(`DELETE FROM inventory WHERE user_id = ?`).run(userId);
  db.prepare(`DELETE FROM plots WHERE user_id = ?`).run(userId);
  db.prepare(`DELETE FROM boosts WHERE user_id = ?`).run(userId);
  db.prepare(`DELETE FROM market_listings WHERE seller_id = ?`).run(userId);
  db.prepare(`DELETE FROM users WHERE id = ?`).run(userId);
}

const REROLL_COST = 1000;

function rerollShop(userId) {
  const user = getOrCreateUser(userId);
  if (user.currency < REROLL_COST) return { ok: false, reason: 'no_funds' };
  addCurrency(userId, -REROLL_COST);
  generateShopStock(userId);
  return { ok: true };
}

module.exports = {
  getOrCreateUser,
  addCurrency,
  getCurrency,
  expandGarden,
  equipTool,
  getEquipped,
  getPlots,
  plantCrop,
  clearPlot,
  addItem,
  removeItem,
  getInventory,
  forceReadyPlots,
  resetUser,
  addTool,
  getToolById,
  removeTool,
  addToolExp,
  addToolGold,
  addLifetimeStats,
  getLatestTool,
  getToolsByFilter,
  getLeaderboard,
  getActiveBoosts,
  addBoost,
  consumeBoostCharges,
  getUpgradeLevel,
  setUpgradeLevel,
  claimDaily,
  countTools,
  unequipTool,
  getAchievements,
  addAchievements,
  checkAndAwardAchievements,
  incrementDailyCount,
  getShopStock,
  shopNextRefresh,
  buyShopSlot,
  rerollShop,
  isToolListed,
  createListing,
  cancelListing,
  getMyListings,
  getListings,
  getListingById,
  buyListing,
};
