const {
  all,
  close,
  get,
  openDatabase,
  run,
} = require("./mysql.utils");

function normalizeStore(store) {
  return String(store || "").trim().toLowerCase();
}

function buildGameUuid(game) {
  const store = normalizeStore(game.store);
  const externalId = String(game.appId || game.link || "").trim();

  if (!store || !externalId) {
    return "";
  }

  return `${store}:${externalId}`;
}

function normalizeServerType(value) {
  return String(value || "").trim().toLowerCase() === "prod" ? "prod" : "stage";
}

async function createActualFreeGamesRepository({ serverType } = {}) {
  const normalizedServerType = normalizeServerType(serverType);
  const database = await openDatabase();
  const actualFreeGameTable = await get(
    database,
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'actual_free_game' LIMIT 1",
  );

  if (!actualFreeGameTable) {
    await close(database);
    throw new Error("Database is not initialized. Run `npm run setup:db` first.");
  }

  return {
    async isKnownGame(game) {
      const uuid = buildGameUuid(game);

      if (!uuid) {
        return false;
      }

      const row = await get(
        database,
        "SELECT id FROM actual_free_game WHERE uuid = ? AND server_type = ? LIMIT 1",
        [uuid, normalizedServerType],
      );

      return Boolean(row);
    },
    async filterNewGames(games) {
      const freshGames = [];

      for (const game of games) {
        if (!(await this.isKnownGame(game))) {
          freshGames.push(game);
        }
      }

      return freshGames;
    },
    async getKnownGameUuidsByType() {
      const rows = await all(
        database,
        "SELECT uuid, type FROM actual_free_game WHERE server_type = ?",
        [normalizedServerType],
      );
      const grouped = {
        steam: new Set(),
        gog: new Set(),
        epic: new Set(),
      };

      for (const row of rows) {
        const type = normalizeStore(row.type);

        if (!grouped[type]) {
          grouped[type] = new Set();
        }

        grouped[type].add(String(row.uuid || "").trim());
      }

      return grouped;
    },
    async saveGame(game) {
      const uuid = buildGameUuid(game);
      const type = normalizeStore(game.store);

      if (!uuid || !type) {
        return false;
      }

      await run(
        database,
        `INSERT IGNORE INTO actual_free_game (uuid, type, server_type, discount_ends_at, created_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [uuid, type, normalizedServerType, String(game.offerEndsAt || "").trim()],
      );

      return true;
    },
    async saveGames(games) {
      for (const game of games) {
        await this.saveGame(game);
      }
    },
    async close() {
      await close(database);
    },
  };
}

module.exports = {
  buildGameUuid,
  createActualFreeGamesRepository,
  normalizeServerType,
};
