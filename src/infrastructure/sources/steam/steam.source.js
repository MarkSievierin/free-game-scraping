const { buildGameUuid } = require("../../../domain/free-game");
const {
  STEAM_URL,
  fetchSteamAppDetails,
  fetchSteamPageMetadata,
  requestText,
} = require("./steam.client");
const {
  parseSteamAppDetails,
  parseSteamPageMetadata,
  parseSteamSearchResults,
} = require("./steam.parser");

const DETAIL_REQUEST_DELAY_MIN_MS = 1000;
const DETAIL_REQUEST_DELAY_MAX_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRandomDelayMs() {
  return Math.floor(
    Math.random() * (DETAIL_REQUEST_DELAY_MAX_MS - DETAIL_REQUEST_DELAY_MIN_MS + 1),
  ) + DETAIL_REQUEST_DELAY_MIN_MS;
}

// A free DLC is only useful to someone who owns its base game, so DLC of paid games is not posted.
async function isDlcOfPaidGame(details) {
  if (details.type !== "dlc" || !details.baseGameAppId) {
    return false;
  }

  await sleep(getRandomDelayMs());
  const baseGamePayload = await fetchSteamAppDetails(details.baseGameAppId);

  return !parseSteamAppDetails(baseGamePayload, details.baseGameAppId).isFree;
}

// Returns null for a game that should not be posted at all.
async function enrichGame(game, index) {
  if (!game.appId) {
    return game;
  }

  try {
    if (index > 0) {
      await sleep(getRandomDelayMs());
    }

    const details = parseSteamAppDetails(await fetchSteamAppDetails(game.appId), game.appId);

    if (await isDlcOfPaidGame(details)) {
      console.log(`Skipped Steam DLC of a paid game: ${game.title}`);
      return null;
    }

    await sleep(getRandomDelayMs());
    const pageHtml = await fetchSteamPageMetadata(game.link);
    const pageMetadata = parseSteamPageMetadata(pageHtml);

    return {
      ...game,
      description: details.description,
      genres: details.genres,
      tags: pageMetadata.tags,
      offerEndsAt: pageMetadata.offerEndsAt,
    };
  } catch (error) {
    console.error(`Steam details fetch failed for ${game.title}: ${error.message}`);

    return {
      ...game,
      description: game.description || "",
      genres: game.genres || [],
      tags: game.tags || [],
      offerEndsAt: game.offerEndsAt || "",
    };
  }
}

async function fetchFreeGames({ limit, knownGameUuids = [] } = {}) {
  const catalogGames = parseSteamSearchResults(await requestText(STEAM_URL));
  const knownGameUuidSet = new Set(knownGameUuids);
  const currentGameUuids = [];
  const games = [];

  for (const game of catalogGames) {
    const gameUuid = buildGameUuid(game);
    currentGameUuids.push(gameUuid);

    if (!knownGameUuidSet.has(gameUuid)) {
      games.push(game);
    }

    if (limit && games.length >= limit) {
      break;
    }
  }

  const enrichedGames = [];

  for (const [index, game] of games.entries()) {
    const enrichedGame = await enrichGame(game, index);

    if (enrichedGame) {
      enrichedGames.push(enrichedGame);
    }
  }

  return {
    games: enrichedGames,
    currentGameUuids,
  };
}

module.exports = {
  fetchFreeGames,
};
