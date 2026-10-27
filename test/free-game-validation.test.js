const assert = require("node:assert/strict");
const test = require("node:test");

const { getMissingGameFields } = require("../src/domain/free-game");
const { splitGamesByCompleteness } = require("../src/application/run-free-games");

function buildCompleteGame(overrides = {}) {
  return {
    store: "epic",
    appId: "sker-ritual-aac702",
    title: "Sker Ritual",
    link: "https://store.epicgames.com/ru/p/sker-ritual-aac702",
    imageUrl: "https://cdn1.epicgames.com/sker-ritual.png",
    description: "Co-op survival FPS.",
    offerEndsAt: "29.10.2026 в 16:00",
    ...overrides,
  };
}

test("a complete game has no missing fields", () => {
  assert.deepEqual(getMissingGameFields(buildCompleteGame()), []);
});

test("blank and whitespace-only fields count as missing", () => {
  assert.deepEqual(
    getMissingGameFields(
      buildCompleteGame({
        imageUrl: undefined,
        description: "   ",
        offerEndsAt: "",
      }),
    ),
    ["imageUrl", "description", "offerEndsAt"],
  );
  assert.deepEqual(getMissingGameFields({}), [
    "title",
    "link",
    "imageUrl",
    "description",
    "offerEndsAt",
  ]);
});

test("run splits new games into publishable and incomplete ones", () => {
  const completeGame = buildCompleteGame();
  const incompleteGame = buildCompleteGame({
    appId: "no-date",
    title: "No Date",
    offerEndsAt: " ",
  });

  assert.deepEqual(splitGamesByCompleteness([completeGame, incompleteGame]), {
    completeGames: [completeGame],
    incompleteGames: [{ game: incompleteGame, missingFields: ["offerEndsAt"] }],
  });
});
