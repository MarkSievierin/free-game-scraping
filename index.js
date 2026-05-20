require("dotenv").config();

const {
  buildFreeGamesTelegramNotifications,
} = require("./src/builders/telegram-notification.builder");
const { TelegramClient } = require("./src/clients/telegram.client");
const { fetchFreeGames: fetchEpicFreeGames } = require("./src/services/epic/free-games.service");
const {
  createActualFreeGamesRepository,
} = require("./src/services/storage/actual-free-games.repository");
const { fetchFreeGames: fetchSteamFreeGames } = require("./src/services/steam/free-games.service");
const { resolveTelegramConfig } = require("./src/services/telegram/telegram-config.service");
const { sendTelegramNotifications } = require("./src/services/telegram/free-games-notification.service");

function resolveMaxGamesLimit(value) {
  const normalizedValue = String(value || "").trim();

  if (!normalizedValue) {
    return undefined;
  }

  const limit = Number.parseInt(normalizedValue, 10);

  if (!Number.isInteger(limit) || limit <= 0) {
    throw new Error("MAX_GAMES must be a positive integer or empty");
  }

  return limit;
}

function resolveBooleanEnv(value, defaultValue) {
  const normalizedValue = String(value || "").trim().toLowerCase();

  if (!normalizedValue) {
    return defaultValue;
  }

  if (["1", "true", "yes", "on"].includes(normalizedValue)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalizedValue)) {
    return false;
  }

  throw new Error(`Invalid boolean env value: ${value}`);
}

async function fetchGamesFromEnabledSources({
  maxGames,
  enableEpic,
  enableSteam,
  knownGameUuidsByType,
}) {
  const games = [];

  if (enableEpic) {
    const epicGames = await fetchEpicFreeGames({
      limit: maxGames,
      knownGameUuids: Array.from(knownGameUuidsByType.epic || []),
    });
    games.push(...epicGames);
  }

  if (enableSteam) {
    const steamGames = await fetchSteamFreeGames({
      limit: maxGames,
      knownGameUuids: Array.from(knownGameUuidsByType.steam || []),
    });
    games.push(...steamGames);
  }

  return games;
}

async function main() {
  const { appType, botToken, chatId } = resolveTelegramConfig();
  const maxGames = resolveMaxGamesLimit(process.env.MAX_GAMES);
  const enableEpic = resolveBooleanEnv(process.env.ENABLE_EPIC, true);
  const enableSteam = resolveBooleanEnv(process.env.ENABLE_STEAM, false);
  const shouldBypassActualFreeGamesFilter = appType !== "prod";

  if (!enableEpic && !enableSteam) {
    throw new Error("At least one source must be enabled: ENABLE_EPIC or ENABLE_STEAM");
  }

  const actualFreeGamesRepository = await createActualFreeGamesRepository();
  const telegramClient = new TelegramClient({ botToken });

  try {
    const knownGameUuidsByType = shouldBypassActualFreeGamesFilter
      ? { steam: new Set(), gog: new Set(), epic: new Set() }
      : await actualFreeGamesRepository.getKnownGameUuidsByType();
    const games = await fetchGamesFromEnabledSources({
      maxGames,
      enableEpic,
      enableSteam,
      knownGameUuidsByType,
    });

    if (games.length === 0) {
      console.log("No free games found.");
      return;
    }

    const gamesToSend = shouldBypassActualFreeGamesFilter
      ? games
      : await actualFreeGamesRepository.filterNewGames(games);

    if (gamesToSend.length === 0) {
      console.log("No new free games to send.");
      return;
    }

    const notifications = buildFreeGamesTelegramNotifications({ chatId, games: gamesToSend });
    const successfulNotifications = await sendTelegramNotifications({ telegramClient, notifications });
    const successfullySentGames = successfulNotifications
      .map((notification) => notification.game)
      .filter(Boolean);

    if (!shouldBypassActualFreeGamesFilter) {
      await actualFreeGamesRepository.saveGames(successfullySentGames);
    }
  } finally {
    await actualFreeGamesRepository.close();
  }
}

main().catch((error) => {
  console.error(`Fatal error: ${error.message}`);
  process.exitCode = 1;
});
