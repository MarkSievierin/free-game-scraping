// A post without any of these looks broken in the channel, so it is held back instead.
const REQUIRED_GAME_FIELDS = ["title", "link", "imageUrl", "description", "offerEndsAt"];

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

function getMissingGameFields(game) {
  return REQUIRED_GAME_FIELDS.filter((field) => !String(game?.[field] ?? "").trim());
}

module.exports = {
  buildGameUuid,
  getMissingGameFields,
  normalizeStore,
};
