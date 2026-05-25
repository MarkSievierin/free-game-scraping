const assert = require("node:assert/strict");
const test = require("node:test");

const { buildGameUuid } = require("../src/services/storage/actual-free-games.repository");
const { parseEpicGamesFromHtml } = require("../src/services/epic/free-games.service");

test("Epic listing parser keeps game id and title from the catalog card", () => {
  const games = parseEpicGamesFromHtml(`
    <a href="/ru/p/example-game">
      <span>Game</span>
      <span>-100%</span>
      <span>Free Now</span>
      <img data-testid="picture-image" alt="Example Game" src="https://cdn.example/image.jpg">
    </a>
  `);

  assert.equal(games.length, 1);
  assert.equal(games[0].store, "epic");
  assert.equal(games[0].appId, "example-game");
  assert.equal(games[0].title, "Example Game");
  assert.equal(games[0].link, "https://store.epicgames.com/ru/p/example-game");
  assert.equal(buildGameUuid(games[0]), "epic:example-game");
});

test("Epic listing parser skips non-free catalog cards", () => {
  const games = parseEpicGamesFromHtml(`
    <a href="/ru/p/paid-game">
      <span>Game</span>
      <span>-50%</span>
      <img data-testid="picture-image" alt="Paid Game" src="https://cdn.example/image.jpg">
    </a>
  `);

  assert.deepEqual(games, []);
});
